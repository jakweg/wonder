FROM alpine:3.17.0
WORKDIR /app
RUN apk update && apk add nodejs npm openssl docker-compose docker
RUN npm i esbuild --location=global
COPY builder builder
RUN esbuild builder/main.ts --outdir=builder-dist --platform=node --out-extension:.js=.mjs
COPY webhook webhook
RUN esbuild webhook/main.ts --outdir=webhook-dist --platform=node --out-extension:.js=.mjs
COPY .env .env
CMD node webhook-dist/main.mjs