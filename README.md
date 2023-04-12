About
=====

HTTP request library based around Node.js' HTTP(S) API interfaces:

- http/https
- ~~http2~~¹
- ~~undici/fetch (_included in Node.js 18_)¹~~

¹ Work in progress

Provides common features such as retry on error, following redirects, progress when downloading file, ...<br />

This library isn't intented to compete nor replace the well known libraries such as got, axios, node-fetch, ...
This is merely educational and for informational purposes in order to learn how HTTP requests work under the hood.

This was originally created as [request-zero](https://www.npmjs.com/package/request-zero) at a time were the module `request` was the main choice and I didn't quite like it.
It had a ton of dependencies, didn't use promises and I needed something very simple.

Example
=======

Simplest call

```js
import { request } from "@xan105/request";
const res = await request("https://www.google.com");
console.log(res.body);
```

JSON

```js
import { getJSON } from "@xan105/request";

const json = await getJSON("https://jsonplaceholder.typicode.com/todos/1");
console.log(json); 
/*Output:
{ userId: 1, id: 1, title: 'delectus aut autem', completed: false }
*/

//Github API
const json = await getJSON("https://api.github.com/repos/user/repo/releases/latest",{
  headers: {"Accept" : "application/vnd.github.v3+json"}
});
console.log(json);
/*Output:
{ url: '...', tag_name: '0.0.0', target_commitish: 'master', ... }
*/
```

Download file(s)

```js
import { download, downloadAll } from "@xan105/request";

//Callback example to output progress in the console
function printProgress(percent, speed, file){
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(`${percent}% @ ${speed} kb/s [${file}]`);
}

//Simple download to disk (pipe to stream)
await download(
  "http://ipv4.download.thinkbroadband.com/1GB.zip", 
  "D:/Downloads", 
  printProgress
);

//Download from github ... aws redirection ... content disposition ... but custom filename
const res = await download(
  "https://github.com/user/repo/releases/download/0.0.0/Setup.exe",
  "D:/Downloads/", 
  { filename: "supersetup.exe" }, 
  printProgress
);
console.log(res); 
/*Output:
{ status: 200, message: 'OK', headers: {...}, path: 'D:\\Downloads\\supersetup.exe' }
*/

//Download a list of files one by one
await request.download.all([
  "http://ipv4.download.thinkbroadband.com/5MB.zip",
  "http://ipv4.download.thinkbroadband.com/10MB.zip",
  "http://ipv4.download.thinkbroadband.com/20MB.zip",
  "http://ipv4.download.thinkbroadband.com/50MB.zip"],
  "D:\\Downloads", printProgress);
```

Download a torrent

```js
import { download } from "@xan105/request/torrent";
download("https://webtorrent.io/torrents/sintel.torrent", "D:\\Downloads");
```

Misc

```js
import * as h1 from "@xan105/request";

//Head request
const res = await h1.head(`http://ipv4.download.thinkbroadband.com/1GB.zip`);
console.log(res);
/*Output:
{ status: 200, message: 'OK', headers: {...} }
*/

//Manually specify retry on error and redirection to follow
await request("https://steamdb.info/app/220/", { maxRetry: 2, maxRedirect: 2 });

//Upload a single file multipart/form-data
const res = await h1.upload(
  "http://127.0.0.1/upload/test/",
  "Hello world", 
  {name: "file", filename: "hello world.txt"}
);
console.log(res);
/*Output:
{ status: 200, message: 'OK', headers: {...}, body: 'ok' }
*/
```

Installation
============

```
npm install @xan105/request
```

## Optional packages

- [webtorrent](https://www.npmjs.com/package/webtorrent)<br />
  Downloading torrent<br />
```
npm i webtorrent
```

- [xml2js](https://www.npmjs.com/package/xml2js)<br />
  XML parser<br />
```
npm i xml2js
```

API
===

⚠️ This module is only available as an ECMAScript module (ESM) starting with version 2.0.0.<br />
Previous version(s) are CommonJS (CJS) with an ESM wrapper.

💡 The underlying API used is determined by which namespace you import.<br />
By default this is the http/https (h1) API.<br />
Torrent related are under the `torrent` namespace.

```js
//Default
import * as h1 from '@xan105/request';

//http/https (h1)
import * as h1 from '@xan105/request/h1';

//http2 (h2)¹
import * as h2 from '@xan105/request/h2';

//Fetch¹
import * as fetch from '@xan105/request/fetch';

//Torrent
import * as torrent from "@xan105/request/torrent";
```

¹ Work in progress (unavailable at the moment)

## Named export

### `request(href: string, payload?: any, option?: obj): Promise<obj>`

This is the core request function every other functions are helper based on this one (_except download, downloadAll and torrent_).

The response obj tries to be similar whether the request failed or succeeded.

```ts
{
  code: string, //HTTP or Node error code
  message: string, //HTTP or Node error message (if any)
  trace: string[], //URL(s) of the request (redirection)
  domain: string, //url domain
  sent: obj, //Header sent
  address?: string, //IP address
  family?: string, //IPv4 or IPv6
  protocol?: string, //HTTP protocol (h1, h2, ...)
  security?: string, //TLS (HTTPS)
  port: number, //Network port
  headers?: obj, //Response header
  body?: string //Response body
}
```

💡 In a dual stack network, IPv4 isn't prefered over IPv6 unlike Node's default behavior (_Node < 17_ ).

💡 When making a `HEAD` request: 

- The promise always resolves no matter the HTTP response code.
- **Doesn't** follow redirection **by design**.<br/>If you need to follow the redirection you can use the headers `location` from the response and make a new `HEAD` request.

#### ⚙️ Options

| option      | type        | default                            | description                                                                        |
| ----------- | ----------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| method      | string      | GET                                | HTTP method: get, post, head, etc                                                  |
| encoding    | string      | utf8                               | Response encoding                                                                  |
| timeout     | number      | 3000 (ms)                          | Time before aborting request                                                       |
| maxRedirect | number      | 3                                  | How many redirections to follow before aborting.<br/>Use 0 to not follow redirects |
| maxRetry    | number      | 0                                  | How many retries on error before aborting.<br/>Use 0 to not retry at all           |
| retryDelay  | number      | 200 (ms)                           | How long to wait before a retry.<br/>Use 0 to instantly retry                      |
| headers     | obj         | -> Chrome UA and UA Hint if https  | Headers of your request                                                            |
| signal      | AbortSignal | none                               | Abort signal                                                                       |

### `get(url: string, option?: obj): Promise<obj>`
Force the `GET` method. Since `request()` default to 'GET' you could just use `request()` directly. This is here for completeness.

### `head(url: string, option?: obj): Promise<obj>`
Force the `HEAD` method.

### `getJSON(url: string, option?: obj): Promise<obj>`
Parse the response body as a JSON string and return the result.<br/>
Force method to `GET` and the header `Accept` to `"application/json, application/json;indent=2"` if not set.

- alias: `getJson()`

### `getXML(url: string, option?: obj): Promise<obj>`

⚠️ Requires the [xml2js](https://www.npmjs.com/package/xml2js) module.

Parse the response body as a XML string and return the result.<br/>
Force method to `GET` and the header `Accept` to `"application/xml"` if not set.

- alias: `getXml()`

### `post(url: string, payload: any, option?: obj): Promise<obj>`
Force method to `POST` and write/push payload.<br/>
NB: On HTTP 301, 302, 303 redirection the method will be [changed to GET](https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections)

### `upload(url: string, payload: any, option?: obj): Promise<obj>`
Force method to `POST` and write/push a multipart/form-data payload.<br/>
You can use option `{fieldname: string, filename: string}` to specify the form field name and the file name.<br/>
If you don't they will default respectively to 'file' and Date.now().<br/>

### `download(href: string, destDir: string, option?: obj, callbackProgress?: fn): Promise<obj>`

Download file to `destDir`.

The response obj is like `request()` minus `body` and with the addition of a `file` obj:
```ts
{
  name: string, //filename
  path: string, //relative
  fullPath: string //absolute
}
```
This is useful for promise chaining to example unzip an archive, etc.

💡 Progress gives you the following stats: percent, speed, file.<br/>
`callbackProgress(percent: number, speed: number, file: string)`

#### ⚙️ Options

| option      | type        | default                            | description                                                                        |
| ----------- | ----------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| timeout     | number      | 3000 (ms)                          | Time before aborting request                                                       |
| maxRedirect | number      | 3                                  | How many redirections to follow before aborting.<br/>Use 0 to not follow redirects |
| maxRetry    | number      | 3                                  | How many retries on error before aborting.<br/>Use 0 to not retry at all           |
| retryDelay  | number      | 1000 (ms)                          | How long to wait before a retry.<br/>Use 0 to instantly retry                      |
| headers     | obj         | -> Chrome UA and UA Hint if https  | Headers of your request                                                            |
| signal      | AbortSignal | none                               | Abort signal                                                                       |
| filename    | string      | null                               | Use this if you want to specify the filename (force rename)                        |
| hash        | obj         | null                               | Verify checksum of downloaded file²                                                |

²Checksum option

```ts
{
  algo: string, //A Node.js supported crypto algo. eg: "sha1"
  sum: string //Checksum
}
```
On error or mismatch it will trigger error/retry.

### `downloadAll(href: string[], destDir: string|string[], option?: obj, callbackProgress?: fn): Promise<obj>`

Download all the files in the list one-by-one to destDir.

If `destDir` is an array, files[i] will be written to destDir[i] in a 1:1 relation.<br/>
In the same fashion you can force the filename of the files with option `{filename: [..,..,..]}`.<br/>
And again same thing for checksum: `{hash: [{algo: ..., sum: ...},..,..]}`.<br/>

Returns an array of `download()` response obj.

## Torrent

### `download(torrent: string, dest: string, option?: obj, callbackProgress?: fn): Promise<obj>`

⚠️ Requires the [webtorrent](https://www.npmjs.com/package/webtorrent) module.

Download files from a torrent url, torrent file, torrent magnet to `destDir`.<br/>

💡 Progress gives you the following stats: percent, speed.<br/>
`callbackProgress(percent: number, speed: number)`

💡 Torrent can be resumed.<br/>

Returns an object with torrent download location, torrent name, and for every files of the torrent its name, relative path and path.<br/>  

```ts
{
  path: string, //absolute
  name: string, //torrent name
  file: [
    {
      name: string, //filename
      path: string, //relative
      fullPath: string //absolute
    }
  ]
}
```



#### ⚙️ Options

| option        | type      | default      | description                                |
| ------------- | ----------| ------------ | ------------------------------------------ |
| timeout       | number    | 10 (sec)     | Time to wait for peers before aborting     |
| exclusion     | string[]  | none         | Exclude files inside the torrent           |
| downloadLimit | number    | -1 (none)    | Download speed limit                       |
| uploadLimit   | number    | 100 (kb/s)   | Upload speed limit                         |
