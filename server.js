'use strict';

const listeningPort = parseInt(process.env.PORT, 10) || 43563;

const os = require('os');
const fs = require('fs');
const url = require('url');
const path = require('path');
const mdns = require('multicast-dns')();
const fetch = require('node-fetch');
const dns = require('dns');

const dnsoptions = { family: 4, verbatim: false, hints: dns.ADDRCONFIG };
const { lookup } = dns.promises;

async function ip() {
  return (await lookup(os.hostname(), dnsoptions)).address;
}

async function allips() {
  const options = { ...dnsoptions, all: true };
  return lookup(os.hostname(), options);
}

// parse data of firmware from version string
const fwv = (s) => parseInt(s.substring(0, 15).replace('-', ''), 10);
// filename of a url
const ufn = (s) => path.basename(url.parse(s).path);

// create basic auth part for update url if SHELLY_AUTH env var is set
const shellyauth = process.env.SHELLY_AUTH ? process.env.SHELLY_AUTH + '@' : '';

function httpd() {
  var contentDisposition = require('content-disposition');
  var finalhandler = require('finalhandler');
  var http = require('http');
  var serveStatic = require('serve-static');

  var serve = serveStatic('./fw', {
    index: false,
    setHeaders: (res, path) => {
      res.setHeader('Content-Disposition', contentDisposition(path));
      console.log('Downloading firmware ...');
    },
  });

  var server = http.createServer((req, res) =>
    serve(req, res, finalhandler(req, res))
  );
  server.listen(listeningPort, '0.0.0.0');
  console.info(`Listening on http://0.0.0.0:${listeningPort}/`);
}

(async () => {
  const firmwares = await (
    await fetch('https://api.shelly.cloud/files/firmware')
  ).json();
  if (!firmwares || (firmwares && !firmwares.isok)) {
    console.error('No firmware information available.');
  } else {
    for (const [devicetype, fw] of Object.entries(firmwares.data)) {
      fw.filename = `${fw.version.split('/')[0]}_${ufn(fw.url)}`;
      let fn = path.join(__dirname, './fw', fw.filename);

      if (!fs.existsSync(fn)) {
        let res = await fetch(fw.url);
        res.body.pipe(fs.createWriteStream(fn));
        console.info(`Downloaded ${fn} (${fw.version})`);
      }
    }
  }

  const localip = process.argv.length > 2 ? process.argv[2] : await ip();

  console.log(`Hostname: ${os.hostname()}, IP4: ${localip}`);
  console.log("All IPs resolved: %j", await allips());
  httpd();

  const shellys = {};

  console.info('Waiting for shellys to appear ...');
  mdns.on('response', function (response) {
    let f = response.answers.filter(
      (v) => v.name.includes('shelly') && v.type === 'A'
    );
    Promise.all(
      f.map(async (v) => {
        // get info from device
        // see https://shelly-api-docs.shelly.cloud/#shelly
        let devicebaseurl = `http://${shellyauth}${v.data}`;
        let deviceinfo = await (await fetch(`${devicebaseurl}/shelly`)).json();
        let otainfo = await (await fetch(`${devicebaseurl}/ota`)).json();
        let shelly = {
          ts: new Date(),
          ip: v.data,
          mac: deviceinfo.mac,
          fw_version: deviceinfo.fw,
          fw_latest: firmwares.data[deviceinfo.type].version,
          needs_upd:
            fwv(deviceinfo.fw) < fwv(firmwares.data[deviceinfo.type].version),
          status: otainfo.status,
          update_url: `${devicebaseurl}/ota?url=http://${localip}:${listeningPort}/${
            firmwares.data[deviceinfo.type].filename
          }`,
        };
        console.clear();
        if (!shellys[v.name] && shelly.needs_upd) {
          shelly.status = 'updating';
          fetch(shelly.update_url);
          console.info(`Will update new device ... ${v.name}`);
        }
        shellys[v.name] = shelly;
        console.table(shellys);
      })
    );
  });
})();
