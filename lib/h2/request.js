import { parse } from "node:url";
import http2 from "node:http2";

import { 
  isObj,
  isString,
  isStringNotEmpty,
  isArrayOfStringNotEmpty,
  isIntegerPositiveOrZero
} from "@xan105/is/type";
import { Failure } from "../util/error.js";
import { UA } from "../util/userAgent.js";
import { standardStatusMessage } from "../util/HTTPStatusCodes.js"; 

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
    signal: option.signal
  };
  
  return new Promise((resolve, reject) => {
    if (!isStringNotEmpty(href) && !isArrayOfStringNotEmpty(href))
      return reject(new Failure("Expecting a non empty string for URL", "ERR_INVALID_ARGS"));
    
    if (isString(href)) href = [href];
    const url = parse(href.at(-1));
    if (!url.hostname || !url.protocol) 
      return reject(new Failure("URL is malformed", "ERR_BAD_URL"));
    if (url.protocol !== "https:")
      return reject(new Failure("Only HTTP/2 over TLS (h2) is supported. Please use HTTPS", "ERR_BAD_URL"));
    
    const session = http2.connect(url.protocol + "//" + url.host);
    session.on('error', (err) => console.error(err));
    
    const req = session.request(Object.assign({}, options.headers, {
      ":method" : options.method.toUpperCase(),
      ":path" : url.pathname + (url.search || ""),
      ":authority": url.host,
      ":scheme": url.protocol.slice(0,-1)
    }),{
      endStream: ["HEAD","GET"].includes(options.method.toUpperCase()),
      signal: options.signal
    });
    
    req.setTimeout(options.timeout, () => { //untested
      req.close();
    });
    req.on('error', (err) => console.error(err));
    
    
    let res = {
      statusCode: 0,
      headers: null,
    };
    
    const details = function(){
      return{
        trace: href,
        address: session.socket.remoteAddress, 
        domain: url.hostname,
        family: session.socket.remoteFamily,
        protocol: session.alpnProtocol || "h2",
        TLS: session.socket.getProtocol?.() || null,
        port: session.socket.remotePort,
        sent: req.sentHeaders
      };
    };

    req.setEncoding(options.encoding);

    req.on('response', (headers) => {
      res.statusCode = headers[':status'];
      delete headers[':status'];
      res.headers = headers;
    });
  
    let data = [];
    req.on('data', (chunk) => { data.push(chunk) });
    
    req.on('end', () => {
      //console.log(data.join(''));
      
      if (res.statusCode === 0){
        //Unexpected not yet received headers ?
      
      } else if (options.method.toUpperCase() === "HEAD"){
        resolve({
          code: res.statusCode,
          message: standardStatusMessage(res.statusCode),
          ...details()
        });
      } else if (res.statusCode >= 200 && res.statusCode < 300){
        resolve({
          code: res.statusCode,
          message: standardStatusMessage(res.statusCode),
          ...details(),
          //body: data.join("")
        });
      } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      
      } else {
        reject({
          code: res.statusCode,
          message: standardStatusMessage(res.statusCode),
          ...details()
        });
      }
      session.close();
    })
  
    req.end();
  });
}

console.log( await request("https://jsonplaceholder.typicode.com/todos/1") );

//export { request };