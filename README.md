# Shelly Offline Updater

![Shelly IoT Device](https://shop.shelly.cloud/image/cache/catalog/shelly_plug_s/s_plug_s_x1-300x300.jpg)

Update [shelly](https://shelly.cloud/) devices from a local network without internet access.

**PRIVATE PROJECT, RUN AT OWN RISK.**

To automatically update all devices in the network, simply start the project with:

```
npm install
npm start
```

or via docker:

```
docker run -it --rm -v "$(pwd):/app" --network host -w /app node:18-alpine npm run shelly-offline-ota-update
```

Note that it may take some time as the application is waiting for shelly device announcements.

## Setting OTA-Server IP Adress

Sometimes the IP to which the shellys shall connect cannot be determined automatically.
This happens when you have a hostfile mapping your hostname to 127.0.0.1 or if you have several
network interfaces.

You can provide the IP via the first commandline argument in this case:

```
node server.js 192.168.0.4
```

## Using the script with login protected shelly

Shelly restricted by login can be updated by providing the login credentials via environment variable `SHELLY_AUTH` as a `username:password` string. Note that the credentials cannot be
set individually for each device but is used for all devices.

```
SHELLY_AUTH="admin:thesecurepassword" node server.js 192.168.0.4
```

> The credentials will be printed on the console and used for a unsecured network connection (http) to the devices.

## Run with docker

You need network host due to mDNS, which is available on linux systems only.

```
docker run -it --rm -v "$(pwd):/app" --network host node:12-alpine node /app/server.js
```
