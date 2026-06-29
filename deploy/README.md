# Deployment

This folder contains optional deployment templates for running MONOPOLY on a
Linux host with nginx, systemd, Node.js, and MongoDB.

The project also works when the React client and Express backend are deployed
separately. In that setup, set `REACT_APP_API_URL` on the frontend to the public
backend URL and set `CLIENT_URL` on the backend to the public frontend URL.

## Files

| File | Purpose |
| --- | --- |
| `monopoly.nginx.conf` | Example nginx server block for hosting the React build and proxying API/WebSocket traffic to Node. |
| `monopoly-server.service` | Example systemd unit for the Express and Socket.IO backend. |
| `push.sh` | Optional rsync-based deployment helper for a single Linux host. |

## Single-Host Deployment

Install Node.js 20+, MongoDB, nginx, and certbot on the server. Create a
dedicated Linux user for the backend:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin monopoly
sudo mkdir -p /opt/monopoly/server /var/www/monopoly /etc/monopoly
sudo chown -R monopoly:monopoly /opt/monopoly/server
```

Create `/etc/monopoly/server.env`:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/monopoly
CLIENT_URL=https://monopoly.example.com
PORT=5004
NODE_ENV=production
SESSION_SECRET=replace-with-a-long-random-secret
ROOM_IDLE_TIMEOUT_MS=900000
```

Copy the service and nginx templates, then adjust the domain and filesystem
paths for your server:

```bash
sudo cp deploy/monopoly-server.service /etc/systemd/system/monopoly-server.service
sudo systemctl daemon-reload
sudo systemctl enable --now monopoly-server

sudo cp deploy/monopoly.nginx.conf /etc/nginx/sites-available/monopoly
sudo ln -sf /etc/nginx/sites-available/monopoly /etc/nginx/sites-enabled/monopoly
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d monopoly.example.com
```

## Deploying With `push.sh`

The helper script builds the client locally, uploads `client/build/` to the
static web root, syncs the backend source, installs production server
dependencies remotely, and restarts systemd.

```bash
DEPLOY_HOST=deploy@example.com \
SERVER_DIR=/opt/monopoly/server \
CLIENT_DIR=/var/www/monopoly \
./deploy/push.sh
```

The defaults in `push.sh` are examples. Use environment variables for real
targets instead of editing secrets into the script.

## Split Frontend/Backend Deployment

When the frontend is served from a different origin than the backend:

```bash
# frontend
REACT_APP_API_URL=https://api.example.com

# backend
CLIENT_URL=https://app.example.com
SESSION_SECRET=replace-with-a-long-random-secret
NODE_ENV=production
```

The backend keeps credentials enabled and does not use wildcard CORS. Make sure
the configured frontend URL exactly matches the browser origin.
