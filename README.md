# Shelly Gen1 Offline Updater

Update [shelly](https://shelly.cloud/) devices from a local network without internet access.

A typical use case is to run this script on local instance with internet access and access to the shelly devices,
which are not connected to the internet (e.g. blocked by firewall).
You do not need to have internet access and access to the shellys at the same time, as this script will
download all current firmwares from <https://api.shelly.cloud/files/firmware> to the local folder `./fw`.
Afterwards you can switch to the shelly device network if needed to perform the update.
This script will then wait for [shelly device announcements](https://shelly-api-docs.shelly.cloud/gen1/#mdns-discovery)
and update the device if a newer firmware is available.

- Shelly Gen 1 Changelog <https://shelly-api-docs.shelly.cloud/gen1/#changelog>
- Shelly Gen 2 Changelog <https://shelly-api-docs.shelly.cloud/gen2/changelog>

**PRIVATE PROJECT, RUN AT OWN RISK. INTERRUPTION OF FIRMWARE UPGRADES MAY LEAD TO BRICKED DEVICES.**

To automatically update all devices in the network, simply start the project with:

via npx

```sh
npx github:bjuretko/shelly-offline-ota-update
```

or from source:

```sh
npm install
npm start
```

Note that it may take some time as the application is waiting for shelly device announcements.

## Setting OTA-Server IP Adress

Sometimes the IP to which the shellys shall connect cannot be determined automatically.
This happens when you have a hostfile mapping your hostname to 127.0.0.1 or if you have several
network interfaces.

You can provide the IP via the first commandline argument in this case:

```sh
node server.js 192.168.0.4
```

## Using the script with login protected shelly

Shelly restricted by login can be updated by providing the login credentials via environment variable `SHELLY_AUTH` as a `username:password` string. Note that the credentials cannot be
set individually for each device but is used for all devices.

```sh
SHELLY_AUTH="admin:thesecurepassword" node server.js 192.168.0.4
```

> The credentials will be printed on the console and used for a unsecured network connection (http) to the devices.

## Run with docker

You need network host due to mDNS, which is available on linux systems only.

```sh
docker run -it --rm -v "$(pwd):/app" --network host -w /app node:12-alpine npm run shelly-offline-ota-update
```
