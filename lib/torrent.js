/*
MIT License

Copyright (c) 2019-2021 Anthony Beaumont

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { join, resolve as resolvePath } from "node:path";

import { 
  isStringNotEmpty,
  isIntegerPositiveOrZero, 
  isArrayOfStringNotEmpty 
} from "@xan105/is/type";
import { Failure } from "./util/error.js";

//optional peerDependencies
import { load } from "./util/optPeerDep.js";
const webtorrent = await load("webtorrent");

function download(torrent, dest, option, callbackProgress = () => {}){
  
  //Multiple opt args
  if (typeof option === "function") {
    callbackProgress = option;
    option = null;
  }
  if (!option) option = {};

  const options = {
    timeout: isIntegerPositiveOrZero(option.timeout) ? option.timeout : 10000,
    exclusion: isArrayOfStringNotEmpty(option.exclusion) ? option.exclusion : [],
  };
  
  return new Promise((resolve, reject) => {
    if(!webtorrent) 
      return reject(new Failure("Couldn't load the module webtorrent", "ERR_MISSING_OPT_MODULE"));
    if(!isStringNotEmpty(torrent) || !isStringNotEmpty(dest))
      return reject(new Failure("Expecting a non empty string for torrent and dest", "ERR_INVALID_ARGS"));
    
    const client = new webtorrent();
    
    client.on("error", function (err) {
      client.destroy(function () {
        return reject(err);
      });
    });
  
    client.add(torrent, { path: dest }, function (torrent) {
      let stats = {
        speed: [],
        averageSpeed: 0,
        time: { started: Date.now(), elapsed: 0, previousElapsed: 0 },
      };

      torrent.deselect(0, torrent.pieces.length - 1, false);
      torrent.files.forEach(function (file) {
        if (options.exclusion.includes(file)) {
          file.deselect();
        } else {
          file.select();
        }
      });

      let timeout = {
        timer: null,
        hasPeers: false,
        clear: function () {
          clearInterval(this.timer);
        },
        set: function () {
          const self = this;
          self.timer = setTimeout(function () {
            if (!self.hasPeers) {
              self.clear();
              client.destroy(function () {
                return reject(new Failure("timeout", "ERR_TIMEOUT"));
              });
            }
          }, options.timeout);
        },
      };
      timeout.set();

      torrent.on("noPeers", function () {
        if (timeout.hasPeers) timeout.set();
        timeout.hasPeers = false;
      }).on("wire", function () {
        if (!timeout.hasPeers) timeout.clear();
        timeout.hasPeers = true;
      }).on("download", function () {
        stats.time.elapsed = Math.floor((Date.now() - stats.time.started) / 1000);
        if (stats.time.elapsed >= 1) {
          const currentSpeed = Math.floor(torrent.downloadSpeed / 1000);
          stats.speed.push(currentSpeed);
          if ( stats.speed.length >= 1 && stats.time.elapsed == stats.time.previousElapsed + 1) {
            const sum = stats.speed.reduce((a, b) => a + b, 0);
            stats.averageSpeed = Math.floor(sum / stats.speed.length);
            stats.speed = [];
          }
        }
        const percent = Math.floor(torrent.progress * 100);
        callbackProgress(percent, stats.averageSpeed);
        stats.time.previousElapsed = stats.time.elapsed;
      }).on("done", function () {
        if (timeout.timer) timeout.clear();

        let result = {
          path: resolvePath(torrent.path),
          name: torrent.name,
          file: [],
        };

        torrent.files.forEach(function (file) {
          result.file.push({
            name: file.name,
            relativePath: file.path,
            path: join(result.path, file.path),
          });
        });

        client.destroy(function () {
          return resolve(result);
        });
      }).on("error", function (err) {
        client.destroy(function () {
          return reject(err);
        });
      });
    });
  });
}

export { download };