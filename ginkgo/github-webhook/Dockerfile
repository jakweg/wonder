FROM denoland/deno:1.20.3

RUN apt update
RUN apt install -y openssl
WORKDIR /app



COPY deps.ts .
RUN deno cache deps.ts

ADD . .
RUN deno cache main.ts

CMD ["run", "-A", "main.ts"]
