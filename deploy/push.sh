#!/usr/bin/env bash
# Build and ship MONOPOLY. Run from the repo root:
#   ./deploy/push.sh

set -euo pipefail

HOST="${DEPLOY_HOST:-deploy@example.com}"
SERVER_DIR="${SERVER_DIR:-/opt/monopoly/server}"
CLIENT_DIR="${CLIENT_DIR:-/var/www/monopoly}"

# 1) Build client locally so the box doesn't need node_modules bloat.
echo "building client..."
pushd client >/dev/null
CI=true npm run build
popd >/dev/null

# 2) Sync client static files.
echo "syncing client to $CLIENT_DIR"
rsync -az --delete client/dist/ "$HOST:$CLIENT_DIR/"

# 3) Sync server source. node_modules rebuilt remotely so native bindings match.
echo "syncing server to $SERVER_DIR"
rsync -az --delete \
    --exclude node_modules \
    --exclude .env \
    --exclude '*.log' \
    server/ "$HOST:$SERVER_DIR/"

# 4) Remote install + restart.
ssh "$HOST" "cd $SERVER_DIR && npm install --omit=dev && sudo systemctl restart monopoly-server"

echo "deployed"
