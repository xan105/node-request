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

import { promisify } from "node:util";
import { request } from "./request.js";
import { download } from "./download.js";
import { Failure } from "../util/error.js";
import { isArrayOfStringNotEmpty, isArray } from "@xan105/is/type";

//optional peerDependencies
import { load } from "../util/optPeerDep.js";
const xml2js = await load("xml2js");

function post(url, payload, option = {}){
  option.method = "POST";
  return request(url, payload, option);
}

function get(url, option = {}){
  option.method = "GET";
  return request(url, option);
}

function head(url, option = {}){
  option.method = "HEAD";
  return request(url, option);
}

async function getJSON(url, option = {}){
  if (!option.headers) option.headers = {};
  if (!option.headers["Accept"]) option.headers["Accept"] = "application/json, application/json;indent=2";
  option.method = "GET";
  
  const { body } = await request(url, option);
  const json = JSON.parse(body);
  return json;
}

async function getXML(url, option = {}) {
  
  if(!xml2js) throw new Failure("Couldn't load the module xml2js", "ERR_MISSING_OPT_MODULE");
  
  if (!option.headers) option.headers = {};
  if (!option.headers["Accept"]) option.headers["Accept"] = "application/xml";
  option.method = "GET";

  const { body } = await request(url, option);
  
  const opts = {
    explicitArray: false,
    explicitRoot: false,
    ignoreAttrs: true,
    emptyTag: null,
  };
  
  const xml = await promisify(xml2js.parseString)(body, opts);
  return xml;
}

async function upload(url, payload, option = {}){
  
  if (!payload) throw new Failure("Invalid payload", "ERR_INVALID_ARGS");

  const crlf = "\r\n";
  const headers = `Content-Disposition: form-data; name="${option.fieldname || "file"}"; filename="${option.filename || Date.now()}"` + crlf;
  const boundary = `--${Math.random().toString(16)}`;
  const delimeter = {
    start: `${crlf}--${boundary}`,
    end: `${crlf}--${boundary}--`,
  };

  const _payload = Buffer.concat([
    Buffer.from(delimeter.start + crlf + headers + crlf),
    Buffer.from(payload),
    Buffer.from(delimeter.end),
  ]);

  if (!option.headers) option.headers = {};
  option.headers["Content-Type"] = "multipart/form-data; boundary=" + boundary;
  option.headers["Content-Length"] = _payload.length;
  option.method = "POST";

  const result = await request(url, _payload, option);
  return result;
}

async function downloadAll(listURL, destDir, option, callbackProgress = () => {}){
  
  if (!isArrayOfStringNotEmpty(listURL)) throw new Failure("Expecting an array of non empty string as listURL", "ERR_INVALID_ARGS");
  
  //Multiple opt args
  if (typeof option === "function") {
    callbackProgress = option;
    option = null;
  }
  if (!option) option = {};

  let count = 0;
  let list = [];

  for (const i in listURL) 
  {
    let itemOption = JSON.parse(JSON.stringify(option)); //Obj copy

    const slice_size = 100 / listURL.length;
    const progressPercent = Math.floor((count / listURL.length) * 100);
    const destination = Array.isArray(destDir) ? destDir[i] : destDir;

    itemOption.filename = isArray(option.filename) ? option.filename[i] : null;
    itemOption.hash = isArray(option.hash) ? option.hash[i] : null;

    const filePath = await download(listURL[i], destination, itemOption,  function (itemPercent, speed, destFile) {
      const percent = progressPercent + Math.floor((slice_size / 100) * itemPercent);
      callbackProgress(percent, speed, destFile);
    });
    
    list.push(filePath);
    count += 1;
  }

  return list;
}

export {
  post,
  get,
  head,
  getJSON,
  getJSON as getJson, //alias
  getXML,
  getXML as getXml, //alias
  upload,
  downloadAll
};