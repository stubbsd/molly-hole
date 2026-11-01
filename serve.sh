#!/bin/sh
# Serve locally: open http://localhost:8080 (or http://<this-computer-ip>:8080 on an iPad on the same Wi-Fi)
cd "$(dirname "$0")" && python3 -m http.server 8080
