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
