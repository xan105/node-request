/* eslint-disable */

import * as h1 from "../lib/h1.js";
import { download as torrent } from "../lib/torrent.js";

let req;

//simple html get
//req = await h1.request("https://www.google.com/");

//simple json get
//req = await h1.getJSON("https://jsonplaceholder.typicode.com/todos/1");

//simple xml get
//req = await h1.getXml("https://cdn.animenewsnetwork.com/encyclopedia/api.xml?anime=4658");

//simple json get github
/*req = await h1.getJSON("https://api.github.com/repos/xan105/Achievement-Watcher/releases/latest", {
  headers: {"Accept" : "application/vnd.github.v3+json"}
});
//download fron github ... redirection aws ... content disposition
const file = await h1.download(req.assets[0].browser_download_url,"./download",printProgress);
console.log(file);*/

//simple head request
//const version = 231;
//req = await h1.head(`http://dl.aion.gameforge.com/aion/AION-LIVE/${version}/Patch/FileInfoMap_AION-LIVE_${version}.dat.zip`);
//req = await h1.head(`http://ipv4.download.thinkbroadband.com/1GB.zip`);
//req = await h1.head(`https://jsonplaceholder.typicode.com/todos/1`);

/*try{
  console.log("zero max retry");
  req = await h1.get("http://127.0.0.1/uplay/ach/54");
  console.log(req);
}catch(err){
  console.error(err);
}
console.log("2 max retry");
req = await h1.get("http://127.0.0.1/uplay/ach/54",{maxRetry: 2});*/

//simple download test
/*req = await h1.download("http://psxdatacenter.com/sbifiles/Resident%20Evil%203%20-%20Nemesis%20(F)%20[SLES-02530]%20sbi.7z","download",{
  filename: "RE3 sbi.7z"
}, printProgress);*/


//big file download test (user agent check)
//req = await h1.download("http://ipv4.download.thinkbroadband.com/1GB.zip","download",printProgress)

//small file list download test
/*
req = await h1.downloadAll([
  "http://ipv4.download.thinkbroadband.com/5MB.zip",
  "http://ipv4.download.thinkbroadband.com/10MB.zip",
  "http://ipv4.download.thinkbroadband.com/20MB.zip",
  "http://ipv4.download.thinkbroadband.com/50MB.zip"],
"download",printProgress);
*/


//checksum download test
/*req = await h1.download("http://ipv4.download.thinkbroadband.com/10MB.zip", "download", {
  hash: {algo: "md5", sum: "3aa55f03c298b83cd7708e90d289afbd"}
}, printProgress);*/

//torrent download test
//req = await torrent("./sintel.torrent", "./download", { downloadLimit: 1000}, printProgress);


//abort
//const controller = new AbortController();
//const signal = controller.signal;

//req = h1.head("https://api.xan105.com/steam/ach/420", { signal: signal, maxRetry: 2} );

/*req = h1.downloadAll([
  "http://ipv4.download.thinkbroadband.com/5MB.zip",
  "http://ipv4.download.thinkbroadband.com/10MB.zip",
  "http://ipv4.download.thinkbroadband.com/20MB.zip",
  "http://ipv4.download.thinkbroadband.com/50MB.zip"],
"download", {signal: signal}, printProgress);*/

//setTimeout( function(){ console.log("cancel"); controller.abort() }, 5 * 1000);
//console.log(await req);


//debug
console.log(req);
function printProgress(percent, speed, dest) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(`${percent}% @ ${speed} kb/s [${dest}]`);
}