/* eslint-disable */

/*
Copyright (c) Anthony Beaumont
This source code is licensed under the MIT License
found in the LICENSE file in the root directory of this source tree.
*/

//WORK IN PROGRESS

import { parse } from "node:url";
import { fetch, Headers } from "undici";

import { 
  isObj, 
  isIntegerPositiveOrZero,
  isString,
  isStringNotEmpty,
  isArrayOfStringNotEmpty
} from "@xan105/is";
import { Failure } from "@xan105/error";
import { UA } from "../util/userAgent.js";

const allowed = {
  mode: ["cors", "no-cors", "same-origin"],
  cache: ["default", "no-store", "reload", "no-cache", "force-cache", "only-if-cached"]
};

function request(href, option = {}){
  
  const headers = {"User-Agent": UA};
  
  const options = {
    method: option.method || "GET",
    encoding: option.encoding || "utf8",
    timeout: isIntegerPositiveOrZero(option.timeout) ? option.timeout : 3000,
    maxRedirect: isIntegerPositiveOrZero(option.maxRedirect) ? option.maxRedirect : 3,
    maxRetry: isIntegerPositiveOrZero(option.maxRetry) ? option.maxRetry : 0,
    retryDelay: isIntegerPositiveOrZero(option.retryDelay) ? option.retryDelay : 200,
    headers: isObj(option.headers) ? Object.assign({}, headers, option.headers) : headers,
    mode: allowed.mode.includes(option.mode) ? option.mode : "cors",
    cache: allowed.cache.includes(option.cache) ? option.cache : "no-store",
    signal: option.signal
  };
  
  return new Promise((resolve, reject) => {
    if (!isStringNotEmpty(href) && !isArrayOfStringNotEmpty(href))
      return reject(new Failure("Expecting a non empty string for URL", "ERR_INVALID_ARGS"));
      
    if (isString(href)) href = [href];
    const url = parse(href.at(-1));
    if (!url.hostname || !url.protocol) 
      return reject(new Failure("URL is malformed", "ERR_BAD_URL"));
    
    const details = {
      trace: href,
      domain: url.hostname,
      sent: options.headers
    };
      
    const controller = new AbortController();
    const signal = controller.signal;
    const abort = function(){ controller.abort() };
    const cleanSignal = function(){ 
      if (options.signal instanceof AbortSignal)
        options.signal.removeEventListener('abort', abort);
    };
    if (options.signal instanceof AbortSignal)
      options.signal.addEventListener('abort', abort, { once : true });
    
    const timeout = setTimeout(function(){ 
      option.maxRetry = options.maxRetry - 1;
      if (option.maxRetry < 0) {
        reject({
          code: "ETIMEOUT",
          message: "connect ETIMEDOUT",
          ...details
        });
        cleanSignal();
        controller.abort();
      } else {
        setTimeout(function(){
          cleanSignal();
          return resolve(request(href, option));
        }, options.retryDelay);
      }
    }, options.timeout);
      
    fetch(url.href, { 
      ...options,
      headers: new Headers(options.headers),
      signal: signal,
      redirect: "manual" 
    })
    .then((res)=>{
      clearTimeout(timeout);

      if (options.method === "HEAD") 
      {
        resolve({
          code: res.status,
          message: res.statusText,
          ...details,
          headers: parseHeaders(res.headers)
        });
        cleanSignal();
      } else if (res.status >= 200 && res.status < 300) { 
        if (res.ok) {
          return res.arrayBuffer().then((buffer) => {
            
            const decoder = new TextDecoder(options.encoding);
            const data = decoder.decode(buffer);
            
            resolve({
              code: res.status,
              message: res.statusText,
              ...details,
              headers: parseHeaders(res.headers),
              body: data
            });
            cleanSignal();
          });
        } else {
          option.maxRetry = options.maxRetry - 1;
          if (option.maxRetry < 0) {
            reject({
              code: "ERR_INTERRUPTED",
              message: "The connection was terminated while the message was still being sent",
              ...details,
              headers: parseHeaders(res.headers)
            });
            cleanSignal();
          } else {
            setTimeout(function () {
              cleanSignal();
              return resolve(request(href, option));
            }, options.retryDelay);
          }
        }
      }
    
    })
    .catch((err)=>{
      clearTimeout(timeout);

      option.maxRetry = options.maxRetry - 1;
      if (option.maxRetry < 0) {
        reject({
          code: err.code,
          message: err.message,
          ...details
        });
        cleanSignal();
      } else {
        setTimeout(function () {
          cleanSignal();
          return resolve(request(href, option));
        }, options.retryDelay);
      }
    });  
  });
}

function parseHeaders(headers) {
  let result = Object.create(null);
  headers.forEach((value, name) => result[name] = value );
  return result;
}

const cs = await request("https://www.google.com");
console.log(cs);