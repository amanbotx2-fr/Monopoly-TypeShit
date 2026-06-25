# Deployment

Maintainer: Aman Kumar  
GitHub: https://github.com/amanbotx2-fr

TODO: set the production frontend domain.
TODO: set the production API domain if it is separate from the frontend domain.
TODO: set the deployment SSH host, deployment user, and remote paths.

## One-time setup

```bash
# pull repo somewhere convenient; only server runs on the box, client is static
ssh TODO_DEPLOY_USER@TODO_DEPLOY_HOST
sudo tee /etc/nginx/sites-available/monopoly-frontend < monopoly.nginx.conf
sudo ln -sf /etc/nginx/sites-available/monopoly-frontend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# TLS
sudo certbot --nginx -d TODO_FRONTEND_DOMAIN
# If the API uses a separate domain:
# sudo certbot --nginx -d TODO_API_DOMAIN

# systemd unit for the node server
sudo cp monopoly-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now monopoly-server
```

## ship new code

```bash
# from local machine
./deploy/push.sh
```

`push.sh` rsyncs `server/` to `/home/TODO_DEPLOY_USER/monopoly-server`, builds the
client locally (`cd client && npm run build`), rsyncs `client/build/` to
`/home/TODO_DEPLOY_USER/monopoly-client`, restarts the systemd unit, and reloads
nginx. The unit uses `/home/TODO_DEPLOY_USER/monopoly-server/.env` (not in git) -
make sure it has:

```
MONGODB_URI=mongodb://localhost:27017/monopoly
CLIENT_URL=https://TODO_FRONTEND_DOMAIN
PORT=5004
NODE_ENV=production
```

## DNS

In the DNS provider for Aman Kumar's production domain, add A/AAAA records:

- `TODO_FRONTEND_DOMAIN` -> TODO_DEPLOY_HOST_PUBLIC_IP
- `TODO_API_DOMAIN` -> TODO_DEPLOY_HOST_PUBLIC_IP, if using a separate API domain

Proxying through Cloudflare is fine. Socket.IO falls back to long-polling
if the websocket upgrade is blocked, but nginx should allow websockets.
