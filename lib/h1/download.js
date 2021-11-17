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

import { parse, URL } from "node:url";
import http from "node:http";
import https from "node:https";
import { join } from "node:path";
import { createWriteStream } from "node:fs";

import { 
  isObj,
  isIntegerPositiveOrZero,
  isString,
  isStringNotEmpty,
  isArrayOfStringNotEmpty
} from "@xan105/is/type";
import {
  unlink,
  stats,
  mkdir,
  hashFile
} from "@xan105/fs";

import { makeURL } from "./request.js";
import { Failure } from "../util/error.js";

function download(href, destDir, option, callbackProgress = ()=>{}){

  //Multiple opt args
  if (typeof option === "function") {
    callbackProgress = option;
    option = null;
  }
  if (!option) option = {};
  
  const headers = {"User-Agent": "Chrome/"};
  
  const options = {
    timeout: isIntegerPositiveOrZero(option.timeout) ? option.timeout : 3000,
    maxRedirect: isIntegerPositiveOrZero(option.maxRedirect) ? option.maxRedirect : 3,
    maxRetry: isIntegerPositiveOrZero(option.maxRetry) ? option.maxRetry : 3,
    retryDelay: isIntegerPositiveOrZero(option.retryDelay) ? option.retryDelay : 1000,
    headers: isObj(option.headers) ? Object.assign(headers, option.headers) : headers,
    filename: isStringNotEmpty(option.filename) ? option.filename : null,
    hash: option.hash && option.hash.algo && option.hash.sum ? option.hash : null
  };
  
  return new Promise((resolve, reject) => {
    if (!isStringNotEmpty(href) && !isArrayOfStringNotEmpty(href))
      return reject(new Failure("Expecting a non empty string for URL", "ERR_INVALID_ARGS"));
    if (!isStringNotEmpty(destDir))
      return reject(new Failure("Expecting a non empty string for destDir", "ERR_INVALID_ARGS"));
    
    if (isString(href)) href = [href];
    const url = makeURL(href, options.headers);
    
    let destPath;
    
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.get(url, (res) => {
    
      if (res.statusCode >= 200 && res.statusCode < 300) 
      {
        const destFile = options.filename ? options.filename : ( getFileName(res.headers) || url.pathname.split("/").pop() );
        destPath = join(destDir, destFile);
      
        mkdir(destDir, { recursive: true }).then(()=>{
        
          const file = createWriteStream(destPath);
          file.on("error", (err) => {
            reject(new Failure(err.message, err.code, {url: url.href, trace: href, headers: res.headers}));
            file.end();
            unlink(destPath).then(()=>{ req.destroy() });
          });
          
          let fileProgress = {
            size: res.headers["content-length"],
            speed: [],
            averageSpeed: 0,
            time: {
              started: Date.now(),
              elapsed: 0,
              previousElapsed: 0
            }
          };

          res.on("data", () => {
            fileProgress.time.elapsed = Math.floor((Date.now() - fileProgress.time.started) / 1000);
            if (fileProgress.time.elapsed >= 1) {
              const currentSpeed = Math.floor(file.bytesWritten / 1000 / fileProgress.time.elapsed);
              fileProgress.speed.push(currentSpeed);

              if (fileProgress.speed.length >= 1 && fileProgress.time.elapsed == fileProgress.time.previousElapsed + 1) {
                  const sum = fileProgress.speed.reduce((a, b) => a + b, 0);
                  fileProgress.averageSpeed = Math.floor(sum / fileProgress.speed.length);
                  fileProgress.speed = [];
              }
            }
            const percent = Math.floor(100 - ((fileProgress.size - file.bytesWritten) / fileProgress.size) * 100);
            callbackProgress(percent, fileProgress.averageSpeed, destFile);
            fileProgress.time.previousElapsed = fileProgress.time.elapsed;
          })
          .on("end", () => {
            callbackProgress(100, 0, destFile);
            file.on("close", () => {
              if (res.complete) 
              {
                stats(destPath).then((fileStats)=>{
                  if (fileStats.size === +res.headers["content-length"]){
                    if (options.hash) {
                      hashFile(destPath, options.hash.algo)
                      .then((sum) => {
                        if (sum.toLowerCase() === options.hash.sum.toLowerCase()) {
                          resolve({
                            code: res.statusCode,
                            message: res.statusMessage,
                            url: url.href,
                            trace: href,
                            headers: res.headers,
                            path: destPath,
                          });
                        } else {
                          option.maxRetry = options.maxRetry - 1;
                          if (option.maxRetry < 0) {
                            reject(new Failure("Unexpected file checksum", "ERR_CHECKSUM_MISMATCH", {url: url.href, trace: href, headers: res.headers}));
                            unlink(destPath);
                          } else {
                            setTimeout(function () {
                              return resolve(download(href, destDir, option, callbackProgress));
                            }, options.retryDelay);
                          }
                        }
                      })
                      .catch((err) => {
                        option.maxRetry = options.maxRetry - 1;
                        if (option.maxRetry < 0) {
                          reject(new Failure(err.message, err.code, {url: url.href, trace: href, headers: res.headers}));
                          unlink(destPath);
                        } else {
                          setTimeout(function () {
                            return resolve(download(href, destDir, option, callbackProgress));
                          }, options.retryDelay);
                        }
                      });
                    } else {
                      resolve({
                        code: res.statusCode,
                        message: res.statusMessage,
                        url: url.href,
                        trace: href,
                        headers: res.headers,
                        path: destPath,
                      });
                    }
                  } else {
                    option.maxRetry = options.maxRetry - 1;
                    if (option.maxRetry < 0) {
                      reject(new Failure("Unexpected file size", "ERR_SIZE_MISMATCH", {url: url.href, trace: href, headers: res.headers}));
                      unlink(destPath);
                    } else {
                      setTimeout(function () {
                        return resolve(download(href, destDir, option, callbackProgress));
                      }, options.retryDelay);
                    }
                  }
                });
              } 
              else 
              {
                option.maxRetry = options.maxRetry - 1;
                if (option.maxRetry < 0) {
                  reject(new Failure("The connection was terminated while the message was still being sent", "ERR_INTERRUPTED", {url: url.href, trace: href, headers: res.headers}));
                  unlink(destPath);
                } else {
                  setTimeout(function () {
                    return resolve(download(href, destDir, option, callbackProgress));
                  }, options.retryDelay);
                }
              }
            });
            file.end();
          })
          .on("error", (err) => {
            file.end();
            option.maxRetry = options.maxRetry - 1;
            if (option.maxRetry < 0) {
              reject(new Failure(err.message, err.code, {url: url.href, trace: href, headers: res.headers}));
              unlink(destPath).then(()=>{ req.destroy() });
            } else {
              setTimeout(function () {
                return resolve(download(href, destDir, option, callbackProgress));
              }, options.retryDelay);
            }
          });
        
          res.pipe(file);
        });
      }
      else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) 
      {
        option.maxRedirect = options.maxRedirect - 1;
        if (option.maxRedirect < 0) {
          return reject(new Failure("Maximum redirection reached", "ERR_REDIRECT_MAX", {url: url.href, trace: href, headers: res.headers}))
        } else {
          const redirect = parse(res.headers.location).hostname ? res.headers.location : new URL(res.headers.location, `${url.protocol}//${url.hostname}`).href;
          href.push(redirect);
          return resolve(download(href, destDir, option, callbackProgress));
        }
      }
      else
      {
        option.maxRetry = options.maxRetry - 1;
        if (option.maxRetry < 0) {
            reject(new Failure(res.statusMessage, res.statusCode, {url: url.href, trace: href, headers: res.headers}));
            unlink(destPath).then(()=>{ req.destroy() });
        } else {
          setTimeout(function (){
            return resolve(download(href, destDir, option, callbackProgress));
          }, options.retryDelay);
        }
      }
    
    }).setTimeout(options.timeout, () => {
      req.destroy();
    }).on("error", (err) => {
      option.maxRetry = options.maxRetry - 1;
      if (option.maxRetry < 0) {
        reject(new Failure(err.message, err.code, {url: url.href, trace: href}));
        unlink(destPath).then(()=>{ req.destroy() });
      } else {
        setTimeout(function () {
          return resolve(download(href, destDir, option, callbackProgress));
        }, options.retryDelay);
      }
    });

    req.end();
  });
}

function getFileName(headers){
  
  const patterns = [
    /filename\*=UTF-8\'\'(.*)/,
    /filename=\"(.*)\"/,
    /filename=(.*)/,
  ];
  
  try {
    for (const pattern of patterns) 
    {
      const matches = headers["content-disposition"].match(pattern);
      if (matches && matches.length >= 2 && matches[1])
        return matches[1];
    }
  }catch{
    return null;
  }
}

export { download };