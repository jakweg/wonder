FROM alpine:3.17.0
RUN apk update && apk add nginx
COPY ./nginx.*.conf /etc/nginx/http.d/
CMD test $SERVE && sleep 1 && nginx -c /etc/nginx/http.d/nginx.$(test "$DEV" && echo dev || echo prod).conf && echo "Serving at port $SERVE" && trap exit INT TERM && while true; do sleep 1; done; true