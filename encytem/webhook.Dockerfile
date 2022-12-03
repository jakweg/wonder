FROM alpine:3.17.0
WORKDIR /app
RUN apk update && apk add nodejs npm git docker
RUN npm i esbuild --location=global
COPY src src
RUN esbuild src/index.ts --outdir=. --platform=node --out-extension:.js=.mjs
COPY .env .env
CMD node ./index.mjs