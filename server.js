#!/usr/bin/env node
'use strict';

// FIXME: use ESM imports here
const os = require('os');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');
const path = require('path');
const mdns = require('multicast-dns')();
// FIXME: npm uninstall node-fetch with node 21 and use native implementation
const fetch = require('node-fetch');
const dns = require('dns');

const listeningPort = parseInt(process.env.PORT || '43563', 10);
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
// extract semantic version string
const fwsv = (s) => s.split(/\/|-/)[2];
// filename of a url
// FIXME: use WHATWG URL API (new URL(...)) instead of url.parse
const ufn = (s) => path.basename(url.parse(s).path, '.zip');

// create basic auth part for update url if SHELLY_AUTH env var is set
const shellyauth = process.env.SHELLY_AUTH;

// create a listening http server from which the shelly will download the firmware files
function httpd() {
  var contentDisposition = require('content-disposition');
  var finalhandler = require('finalhandler');
  var http = require('http');
  var serveStatic = require('serve-static');

  var serve = serveStatic('./fw', {
    index: false,
    setHeaders: (res, path) => {
      res.setHeader('Content-Disposition', contentDisposition(path));
      console.log('Downloading firmware ...', path);
    },
  });

  var server = http.createServer((req, res) => {
    res.on('finish', () =>
      console.log('Finished download', res.statusCode, req.url)
    );
    serve(req, res, finalhandler(req, res));
  });
  server.listen(listeningPort, '0.0.0.0');
  console.info(`Listening on http://0.0.0.0:${listeningPort}/`);
}

// available firmware files downloaded at startup
const firmware_files = {};

// download all latest Shelly Gen1 firmware files
async function downloadGen1FirmwareFiles() {
  const firmwares = await (
    await fetch('https://api.shelly.cloud/files/firmware')
  ).json();
  if (!firmwares || (firmwares && !firmwares.isok)) {
    console.error('No firmware information available.');
  } else {
    for (const [devicetype, fw] of Object.entries(firmwares.data)) {
      fw.build_id = fw.version;
      fw.version = fw.build_id.split('/')[1];
      fw.filename = `${ufn(fw.url)}_${fw.version}`;
      let fn = path.join(__dirname, './fw', fw.filename);

      firmware_files[devicetype] = fw;

      if (!fs.existsSync(fn)) {
        let res = await fetch(fw.url);
        res.body.pipe(fs.createWriteStream(fn));
        console.info(`Downloaded ${fn} (${fw.version})`);
      }
    }
  }
}

// download all latest Shelly Gen2 firmware files
async function downloadGen2FirmwareFiles() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const deviceAppIds = [
    'PlugUS',
    'PlusPlugS',
    'Plus1PM',
    'Plus1',
    'Pro1',
    'Pro1PM',
    'Plus2PM',
    'Pro2PM',
    'Pro2',
    'PlusI4',
    'PlusWallDimmer',
    'Pro4PM',
    'Pro3',
    'Pro3EM',
    'PlusHT',
    'PlusSmoke',
    'PlusRGBW',
    'BluGw',
    'PlusPlugIT',
    'PlusPlugUK',
    'xLG3',
    'Plus1PMMini',
    'Plus1Mini',
    'ProEM',
    'PlusPMMini',
    'Plus10V',
    'PlusUni',
  ];

  for (const deviceType of deviceAppIds) {
    const firmwares = await (
      await fetch(`https://updates.shelly.cloud/update/${deviceType}`)
    ).json();
    if (!firmwares || (firmwares && !firmwares.stable)) {
      console.error(
        'No firmware information available for device type',
        deviceType
      );
    } else {
      const fw = firmwares.stable;
      fw.version = fw.build_id.split('/')[1];
      fw.filename = `${deviceType}-${fw.version}`;
      let fn = path.join(__dirname, './fw', fw.filename);

      firmware_files[deviceType] = fw;

      if (!fs.existsSync(fn)) {
        let res = await fetch(fw.url);
        res.body.pipe(fs.createWriteStream(fn));
        console.info(`Downloaded ${fn} (${fw.version})`);
      }
    }
  }
}

async function shellyFetch(url) {
  return fetch(
    url,
    shellyauth
      ? {
          headers: {
            Authorization: `Basic ${btoa(shellyauth)}`,
          },
        }
      : undefined
  );
}

async function shellyOTAInformation(ipAdressString) {
  // get info from device
  // see https://shelly-api-docs.shelly.cloud/#shelly
  const devicebaseurl = `http://${ipAdressString}`;

  const deviceinfo = await (
    await shellyFetch(`${devicebaseurl}/shelly`)
  ).json();

  const gen2 = deviceinfo['gen'] === 2;
  const product_id = gen2 ? deviceinfo.app : deviceinfo.type;
  const fw_version = gen2 ? deviceinfo.fw_id : deviceinfo.fw;
  const fw_latest = firmware_files[product_id].build_id;

  if (!gen2) deviceinfo.ver = fwsv(fw_version);
  deviceinfo.baseurl = devicebaseurl;
  deviceinfo.product_id = product_id;

  const shelly = {
    ts: new Date(),
    ip: ipAdressString,
    mac: deviceinfo.mac,
    fw_version,
    fw_latest,
    needs_upd: fwv(fw_version) < fwv(fw_latest),
    info: deviceinfo,
  };
  return shelly;
}

(async () => {
  const localip = process.argv.length > 2 ? process.argv[2] : await ip();

  await downloadGen1FirmwareFiles();
  await downloadGen2FirmwareFiles();

  console.log(`Hostname: ${os.hostname()}, IP4: ${localip}`);
  console.log('All IPs resolved: %j', await allips());
  httpd();

  const shellys = {};

  console.info('Waiting for shellys to appear ...');

  // discover all available service types
  mdns.on('response', function (response) {
    let f = response.answers.filter(
      (v) => v.name.toLowerCase().includes('shelly') && v.type === 'A'
    );
    if (f.length === 0) return;

    Promise.all(
      f.map(async (v) => {
        const shelly = await shellyOTAInformation(v.data);

        if (!shellys[v.name] && shelly.needs_upd) {
          console.dir(shelly);
          const qs = querystring.stringify({
            url: `http://${localip}:${listeningPort}/${
              firmware_files[shelly.info.product_id].filename
            }`,
          });
          const update_url = `${shelly.info.baseurl}/ota?${qs}`;
          console.info('Updating: ', update_url);
          shelly.info = 'updating';
          await shellyFetch(update_url);
        }

        shellys[v.name] = shelly;
      })
    ).then(() => {
      console.clear();
      console.table(shellys);
    });
  });
})();
