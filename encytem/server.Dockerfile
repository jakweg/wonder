FROM alpine:3.17.0
RUN apk update && apk add nginx
COPY ./nginx.conf /etc/nginx/http.d/default.conf 
CMD test $SERVE && sleep 1 && nginx && echo "Serving at port $SERVE" && trap exit INT TERM && while true; do sleep 1; done; true