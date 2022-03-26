FROM denoland/deno:1.20.3

RUN apt update
RUN apt install -y git curl python
WORKDIR /app

RUN curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-378.0.0-linux-x86_64.tar.gz
RUN tar -xf google-cloud-sdk-378.0.0-linux-x86_64.tar.gz
RUN rm google-cloud-sdk-378.0.0-linux-x86_64.tar.gz


COPY deps.ts .
RUN deno cache deps.ts

ADD . .
RUN deno cache main.ts
RUN chmod a+r private-key.json

CMD ["run", "-A", "main.ts"]
