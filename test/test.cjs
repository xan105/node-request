/* eslint-disable */

"use strict";

const request = require("../lib/request.cjs");

(async()=>{

let req;

//simple html get
//req = await request("https://steamdb.info/app/420/");

//simple json get
//req = await request.getJson("https://api.xan105.com/steam/ach/420");
//req = await request.getJson("https://jsonplaceholder.typicode.com/todos/1");

//simple xml get
//req = await request.getXml("https://cdn.animenewsnetwork.com/encyclopedia/api.xml?anime=4658");

//simple json get github
//req = await request.getJson("https://api.github.com/repos/xan105/Achievement-Watcher/releases/latest",{headers: {"Accept" : "application/vnd.github.v3+json"}});
//req2 = await request.download(req.assets[0].browser_download_url,"./",printProgress);

//simple head request
//let version = 231;
//req = await request.head(`http://dl.aion.gameforge.com/aion/AION-LIVE/${version}/Patch/FileInfoMap_AION-LIVE_${version}.dat.zip`);

//req = await request.head(`http://ipv4.download.thinkbroadband.com/1GB.zip`);

/*try{
  console.log("zero max retry");
  req = await request.get("http://127.0.0.1/uplay/ach/54");
  console.log(req);
}catch(err){
  console.error(err);
}
console.log("2 max retry");
req = await request.get("http://127.0.0.1/uplay/ach/54",{maxRetry: 2});*/

//simple download test
//req = await request.download("http://psxdatacenter.com/sbifiles/Resident%20Evil%203%20-%20Nemesis%20(F)%20[SLES-02530]%20sbi.7z","download",{filename: "RE3 sbi.7z"}, printProgress);

//download fron github ... redirection aws ... content disposition
//req = await request.download("https://github.com/xan105/Achievement-Watcher/releases/download/1.1.0/Achievement.Watcher.Setup.exe","download",{filename: "supersetup.exe"}, printProgress);

//big file download test (user agent check)
//req = await request.download("http://ipv4.download.thinkbroadband.com/1GB.zip","download",printProgress)

//small file list download test
/*req = await request.download.all(["http://ipv4.download.thinkbroadband.com/5MB.zip",
                                  "http://ipv4.download.thinkbroadband.com/10MB.zip",
                                  "http://ipv4.download.thinkbroadband.com/20MB.zip",
                                  "http://ipv4.download.thinkbroadband.com/50MB.zip"],
                                  "download",printProgress)*/

//checksum download test
//req = await request.download("http://ipv4.download.thinkbroadband.com/10MB.zip","download",{hash: {algo: "md5", sum: "3aa55f03c298b83cd7708e90d289afbd"}}, printProgress);

//torrent download test
//request.download.torrent("https://webtorrent.io/torrents/sintel.torrent","download",printProgress);

//req = await request.getJson("http://127.0.0.1/steam/ach/420",{maxRetry: 1});

//req = await request.upload("http://127.0.0.1/uplay/share", Buffer.from("Hello world"), {name: "file", filename: "hello world.txt"});

//req = await request.get("https://steamdb.info/app/220/",{method:"POST"});

console.log(req);
})().catch(console.error);

function printProgress(percent, speed, dest){
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`${percent}% @ ${speed} kb/s [${dest}]`);
}