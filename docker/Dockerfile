# Build context is staged by deploy-nas.sh:
#   fh6/      - Forza Horizon 6 app
#   fh5/      - Forza Horizon 5 app
#   selector/ - forza.ba.id.au landing page (no dependencies)
#   start.js
FROM node:24-alpine

WORKDIR /app
RUN npm install -g pnpm@9

COPY fh6/package.json fh6/pnpm-lock.yaml fh6/
RUN cd fh6 && pnpm install --prod --frozen-lockfile

COPY fh5/package.json fh5/package-lock.json fh5/
RUN cd fh5 && npm ci --omit=dev

COPY fh6 fh6
COPY fh5 fh5
COPY selector selector
COPY start.js .

ENV NODE_ENV=production
USER node
# FH6 on 6666, FH5 on 5555 (each app serves HTTP and receives UDP telemetry on the same port)
# Selector on 8080 (HTTP only, override with PORT)
EXPOSE 6666/tcp 6666/udp 5555/tcp 5555/udp 8080/tcp
CMD ["node", "start.js"]
