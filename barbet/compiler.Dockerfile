FROM alpine:3.17.0
WORKDIR /app/barbet
RUN apk update && apk add nodejs npm
RUN npm i esbuild --location=global
COPY package*.json ./
RUN npm ci
COPY src/build src/build
COPY tsconfig.json ./
RUN esbuild src/build/index.ts --outdir=. --platform=node --out-extension:.js=.mjs
CMD node ./index.mjs