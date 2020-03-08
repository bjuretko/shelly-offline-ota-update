const mdns = require('multicast-dns')();
const fetch = require('node-fetch');

const fwv = s => parseInt(s.substring(0, 15).replace('-', ''), 10);

  (async () => {
    const firmwares = await (await fetch('https://api.shelly.cloud/files/firmware')).json();
    if (!firmwares) console.error("No firmware information available.")
    const shellys = {};

    console.info('Waiting for shellys to appear ...');
    mdns.on('response', function (response) {
      let f = response.answers.filter(
        v => v.name.includes('shelly') && v.type === 'A'
      );
      Promise.all(f.map(async v => {
        if (!shellys[v.name]) {
          let deviceinfo = await (await fetch(`http://${v.data}/shelly`)).json();
          shellys[v.name] = {
            ip: v.data,
            hostname: v.name,
            mac: deviceinfo.mac,
            fw_version: deviceinfo.fw,
            fw_latest: firmwares.data[deviceinfo.type].version,
            fw_new: fwv(deviceinfo.fw)<fwv(firmwares.data[deviceinfo.type].version),
            fw_url: firmwares.data[deviceinfo.type].url,
          };
          console.clear();
          console.table(shellys);
        }
      }))
      //console.log(`${v.data}: ${v.name}`)
    });
  })();