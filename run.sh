#!/bin/sh
sudo docker run -it --rm -v "$(pwd):/app" --network host node:12-alpine node /app/server.js