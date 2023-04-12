/*
Copyright (c) Anthony Beaumont
This source code is licensed under the MIT License
found in the LICENSE file in the root directory of this source tree.
*/

import http from "node:http";
import https from "node:https";
import { parse, URL } from "node:url";
import { lookup } from "node:dns";
import { 
  isObj, 
  isString,
  isStringNotEmpty,
  isArrayOfStringNotEmpty
} from "@xan105/is";
import{ 
  asStringNotEmpty,
  asIntegerPositiveOrZero
} from "@xan105/is/opt";
import { Failure } from "@xan105/error";
import { UA, UAHint } from "../util/userAgent.js";
import { standardStatusMessage } from "../util/HTTPStatusCodes.js";

function request(href, payload, option = {}){
  return new Promise((resolve, reject) => {
  
    //Multiple opt args
    if (isObj(payload)) {
      option = payload;
      payload = null;
    }

    const headers = {
      "User-Agent": UA,
      "Sec-GPC": 1 //Do not track
    };
    
    const options = {
      method: asStringNotEmpty(option.method) ?? "GET",
      encoding: asStringNotEmpty(option.encoding) ?? "utf8",
      timeout: asIntegerPositiveOrZero(option.timeout) ?? 3000,
      maxRedirect: asIntegerPositiveOrZero(option.maxRedirect) ?? 0,
      maxRetry: asIntegerPositiveOrZero(option.maxRetry) ?? 0,
      retryDelay: asIntegerPositiveOrZero(option.retryDelay) ?? 200,
      headers: isObj(option.headers) ? Object.assign({}, headers, option.headers) : headers,
      signal: option.signal
    };
  
    if (!isStringNotEmpty(href) && !isArrayOfStringNotEmpty(href))
      return reject(new Failure("Expecting a non empty string for URL", "ERR_INVALID_ARGS"));

    if (isString(href)) href = [href];
    const url = parse(href.at(-1));
    if (!url.hostname || !url.protocol) 
      return reject(new Failure("URL is malformed", "ERR_BAD_URL"));
    
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(Object.assign({}, url, {
      method: options.method.toUpperCase(),
      headers: url.protocol === "https:" ? Object.assign({}, UAHint, options.headers) : options.headers,
      lookup: (hostname, opts, cb) => { 
        opts.verbatim = true; //Do not prefer IPv4 over IPv6 (this will be the default in Node17)
        lookup(hostname, opts, cb)
      },
      signal: options.signal
    }), (res) => {

      res.setEncoding(options.encoding);
      
      const details = {
        trace: href,
        address: res.socket.remoteFamily === "IPv6" ? "[" + res.socket.remoteAddress + "]" : res.socket.remoteAddress, 
        domain: url.hostname,
        family: res.socket.remoteFamily,
        protocol: "http/" + res.httpVersion,
        security: res.socket.getProtocol?.() || null,
        port: res.socket.remotePort,
        sent: req._header,
        headers: res.headers
      };
      
      if (req.method === "HEAD") 
      {
        resolve({
          code: res.statusCode,
          message: res.statusMessage,
          ...details
        });
      } 
      else if (res.statusCode >= 200 && res.statusCode < 300) 
      {
        const data = [];
        
        res.on("data", (chunk) => {
          data.push(chunk);
        }).on("end", () => {
          if (res.complete) {
            resolve({
              code: res.statusCode,
              message: res.statusMessage || standardStatusMessage(res.statusCode),
              ...details,
              body: data.join("")
            });
          } else {
            option.maxRetry = options.maxRetry - 1;
            if (option.maxRetry < 0) {
              reject({
                code: "ERR_INTERRUPTED",
                message: "The connection was terminated while the message was still being sent", 
                ...details
              });
            } else {
              setTimeout(function (){
                return resolve(request(href, payload, option));
              }, options.retryDelay);
            }
          }
        }).on("error", (err) => {
          option.maxRetry = options.maxRetry - 1;
          if (option.maxRetry < 0) {
            reject({
              code: err.code,
              message: err.message, 
              ...details
            });
            req.destroy();
          } else {
            setTimeout(function (){
              return resolve(request(href, payload, option));
            }, options.retryDelay);
          }
        }); 
      }
      else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) 
      {
        option.maxRedirect = options.maxRedirect - 1;
        if (option.maxRedirect < 0) {
          reject({
            code: res.statusCode,
            message: res.statusMessage || standardStatusMessage(res.statusCode),
            ...details
          });
        } else {
          const redirect = parse(res.headers.location).hostname ? res.headers.location : new URL(res.headers.location, `${url.protocol}//${url.hostname}`).href;
          href.push(redirect);
          
          if (req.method === "POST" && [301, 302, 303].includes(res.statusCode)){
            option.method = "GET";
            if (option.headers) {
              delete option.headers["content-length"];
              delete option.headers["content-type"];
            }
            if (payload) payload = null;
          }
          
          return resolve(request(href, payload, option));
        }
      }
      else
      {
        option.maxRetry = options.maxRetry - 1;
        if (option.maxRetry < 0) {
            reject({
              code: res.statusCode,
              message: res.statusMessage || standardStatusMessage(res.statusCode),
              ...details
            });
            req.destroy();
        } else {
          setTimeout(function (){
            return resolve(request(href, payload, option));
          }, options.retryDelay);
        }
      }
    
    }).setTimeout(options.timeout, () => {
       req.destroy();
    }).on("error", (err) => {
      const aborted = options.signal instanceof AbortSignal && err.code === "ABORT_ERR";
      option.maxRetry = options.maxRetry - 1;
      if (aborted || option.maxRetry < 0) {
        reject({
          code: err.code,
          message: err.message,
          trace: href,
          domain: url.hostname,
          sent: req._header
        });
        req.destroy();
      } else {
        setTimeout(function () {
          return resolve(request(href, payload, option));
        }, options.retryDelay);
      }
    });

    if (req.method === "POST") {
      if (!payload) {
        reject(new Failure("Invalid payload", "ERR_INVALID_ARGS"));
        req.destroy();
      } else {
        req.write(payload);
      }
    }
    
    req.end();
  });
}

export { request };