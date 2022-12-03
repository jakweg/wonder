FROM alpine:3.17.0
RUN apk update && apk add nginx
COPY ./src/build/nginx.conf /etc/nginx/http.d/default.conf 
CMD test $SERVE && nginx && echo "Serving at port $SERVE" && sleep 9999d || true