'use strict';

var os = require('os');
const fs = require('fs');
var url = require('url');
var path = require('path');
const mdns = require('multicast-dns')();
const fetch = require('node-fetch');

async function ip(options) {
  const { lookup } = require('dns').promises;
  return (await lookup(os.hostname(), options)).address;
}

// parse data of firmware from version string
const fwv = s => parseInt(s.substring(0, 15).replace('-', ''), 10);
// filename of a url
const ufn = s => path.basename(url.parse(s).path);

function httpd() {
  var contentDisposition = require('content-disposition');
  var finalhandler = require('finalhandler');
  var http = require('http');
  var serveStatic = require('serve-static');

  var serve = serveStatic('./fw', {
    index: false,
    setHeaders: (res, path) =>
      res.setHeader('Content-Disposition', contentDisposition(path))
  });

  var server = http.createServer((req, res) =>
    serve(req, res, finalhandler(req, res))
  );
  server.listen(3000, '0.0.0.0');
  console.info('Listening on http://0.0.0.0:3000/');
}

(async () => {
  const firmwares = await (
    await fetch('https://api.shelly.cloud/files/firmware')
  ).json();
  if (!firmwares || (firmwares && !firmwares.isok)) {
    console.error('No firmware information available.');
  } else {
    for (const [devicetype, fw] of Object.entries(firmwares.data)) {
      let res = await fetch(fw.url);
      let fn = path.join(__dirname, './fw', ufn(fw.url));
      res.body.pipe(fs.createWriteStream(fn));
      console.info(`Downloaded ${fn} (${fw.version})`);
    }
  }

  const localip = await ip({ family: 4, verbatim: false });

  console.log(`Hostname: ${os.hostname()}, IP4: ${localip}`);
  httpd();

  const shellys = {};

  console.info('Waiting for shellys to appear ...');
  mdns.on('response', function(response) {
    let f = response.answers.filter(
      v => v.name.includes('shelly') && v.type === 'A'
    );
    Promise.all(
      f.map(async v => {
        let deviceinfo = await (await fetch(`http://${v.data}/shelly`)).json();

        let shelly = {
          ts: new Date(),
          ip: v.data,
          mac: deviceinfo.mac,
          fw_version: deviceinfo.fw,
          fw_latest: firmwares.data[deviceinfo.type].version,
          needs_upd:
            fwv(deviceinfo.fw) < fwv(firmwares.data[deviceinfo.type].version),
          state: 'new', // updating, updated
          update_url: `http://${v.data}/ota?url=http://${localip}:3000/${ufn(
            firmwares.data[deviceinfo.type].url
          )}`
        };

        shellys[v.name] = shelly;
        console.clear();
        console.table(shellys);
        for (s of shellys.values()) console.log(s.update_url);
      })
    );
  });
})();
