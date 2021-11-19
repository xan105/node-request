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
import { lookup } from "node:dns";

import { 
  isObj, 
  isIntegerPositiveOrZero,
  isString,
  isStringNotEmpty,
  isArrayOfStringNotEmpty
} from "@xan105/is/type";
import { Failure } from "../util/error.js";
import { UA } from "../util/userAgent.js";

function request(href, payload, option = {}){

  //Multiple opt args
  if (isObj(payload)) {
    option = payload;
    payload = null;
  }

  const headers = {"User-Agent": UA};
  
  const options = {
    method: option.method || "GET",
    encoding: option.encoding || "utf8",
    timeout: isIntegerPositiveOrZero(option.timeout) ? option.timeout : 3000,
    maxRedirect: isIntegerPositiveOrZero(option.maxRedirect) ? option.maxRedirect : 3,
    maxRetry: isIntegerPositiveOrZero(option.maxRetry) ? option.maxRetry : 0,
    retryDelay: isIntegerPositiveOrZero(option.retryDelay) ? option.retryDelay : 200,
    headers: isObj(option.headers) ? Object.assign({}, headers, option.headers) : headers,
    signal: option.signal
  };
  
  return new Promise((resolve, reject) => {
    if (!isStringNotEmpty(href) && !isArrayOfStringNotEmpty(href))
      return reject(new Failure("Expecting a non empty string for URL", "ERR_INVALID_ARGS"));

    if (isString(href)) href = [href];
    const url = parse(href.at(-1));
    if (!url.hostname || !url.protocol) 
      return reject(new Failure("URL is malformed", "ERR_BAD_URL"));
    
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(Object.assign({}, url, {
      method: options.method.toUpperCase(),
      headers: options.headers,
      lookup: (hostname, opts, cb) => { 
        opts.verbatim = true; //Do not prefer IPv4 over IPv6 (this will be the default in Node17)
        lookup(hostname, opts, cb)
      },
      signal: options.signal
    }), (res) => {

      res.setEncoding(options.encoding);
      
      const details = {
        trace: href,
        address: res.socket.remoteAddress, 
        domain: url.hostname,
        family: res.socket.remoteFamily,
        protocol: "http/" + res.httpVersion,
        TLS: res.socket.getProtocol?.() || null,
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
        let data = [];
        
        res.on("data", (chunk) => {
          data.push(chunk);
        }).on("end", () => {
          if (res.complete) {
            resolve({
              code: res.statusCode,
              message: res.statusMessage,
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
        if (options.maxRedirect < 0) {
          reject({
            code: "ERR_REDIRECT_MAX",
            message: "Maximum redirection reached", 
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
              message: res.statusMessage,
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