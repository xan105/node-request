/*
Copyright (c) Anthony Beaumont
This source code is licensed under the MIT License
found in the LICENSE file in the root directory of this source tree.
*/

import { join, isAbsolute, relative } from "node:path";
import { resolve as resolvePath, normalize } from "@xan105/fs/path";
import { 
  isStringNotEmpty,
} from "@xan105/is";
import {
  asIntegerPositive,
  asIntegerPositiveOrZero,
  asArrayOfStringNotEmpty 
} from "@xan105/is/opt";
import { Failure } from "@xan105/error";

//optional peerDependencies
import { load } from "./util/optPeerDep.js";
const webtorrent = await load("webtorrent");

function download(torrent, dest, option, callbackProgress = () => {}){
  return new Promise((resolve, reject) => {
  
    //Multiple opt args
    if (typeof option === "function") {
      callbackProgress = option;
      option = null;
    }
    if (!option) option = {};

    const options = {
      timeout: asIntegerPositiveOrZero(option.timeout) ?? 10,
      exclusion: asArrayOfStringNotEmpty(option.exclusion) ?? [],
      downloadLimit: asIntegerPositive(option.downloadLimit) ?? -1,
      uploadLimit: asIntegerPositive(option.uploadLimit) ?? 100 
    };
  
    if(!webtorrent) 
      return reject(new Failure("Couldn't load the module webtorrent", "ERR_MISSING_OPT_MODULE"));
    if(!isStringNotEmpty(torrent) || !isStringNotEmpty(dest))
      return reject(new Failure("Expecting a non empty string for torrent and dest", "ERR_INVALID_ARGS"));
    
    const client = new webtorrent({
      downloadLimit: options.downloadLimit > -1 ? options.downloadLimit * 1000 : -1,
      uploadLimit: options.uploadLimit * 1000
    });
    
    client.on("error", function (err) {
      client.destroy(function () {
        return reject(err);
      });
    });
  
    client.add(torrent, { path: dest }, function (torrent) {
      const stats = {
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

      const timeout = {
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
                return reject(new Failure("timeout", "ERR_TIMEOUT_NO_PEERS"));
              });
            }
          }, options.timeout * 1000);
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

        const result = {
          path: resolvePath(torrent.path),
          name: torrent.name,
          file: [],
        };

        torrent.files.forEach(function (file) {
          result.file.push({
            name: file.name,
            path: normalize(isAbsolute(file.path) ? relative(result.path, file.path) : file.path), 
            fullPath: isAbsolute(file.path) ? file.path : join(result.path, file.path)
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