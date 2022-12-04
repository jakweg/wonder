FROM alpine:3.17.0
WORKDIR /app/barbet
RUN apk update && apk add nodejs npm
RUN npm i esbuild prettier --location=global
COPY package*.json /tmp/compiled-builder/
RUN cd /tmp/compiled-builder && npm i
COPY src/build src/build
RUN esbuild src/build/index.ts src/build/compile-enums.ts --outdir=/tmp/compiled-builder --platform=node --out-extension:.js=.mjs
CMD test $DONT_RUN && echo "Developer compiler is inactive" || node /tmp/compiled-builder/index.mjs ; true