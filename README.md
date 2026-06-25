# Monopoly

Online browser Monopoly. Richup.io-style: lobby rules, custom boards, auctions, trades with negotiation, mortgage, chat, sound. No accounts, just pick a name and a color.

Owned and maintained by Aman Kumar.

GitHub: https://github.com/amanbotx2-fr

TODO: add production website URL.
TODO: add production API URL.

## stack

React 19 client, Node/Express + Socket.IO server, MongoDB. In-memory game state with periodic snapshot to MongoDB.

## running it locally

Need Node 18+ and a local MongoDB.

server:

```bash
cd server
npm install
# .env needs:
#   MONGODB_URI=mongodb://localhost:27017/monopoly
#   CLIENT_URL=http://localhost:3000
#   PORT=5004
node index.js
```

client:

```bash
cd client
npm install
npm start
```

## deploy

See `deploy/` for nginx configs and the systemd unit template.
TODO: update deployment host, user, domains, TLS targets, and remote paths before deploying.
