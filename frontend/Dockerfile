FROM nginx:stable-alpine

ENV API_BASE_URL=""

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/10-write-config.sh /docker-entrypoint.d/10-write-config.sh
RUN chmod +x /docker-entrypoint.d/10-write-config.sh

COPY . /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/nginx.conf \
    && rm -f /usr/share/nginx/html/Dockerfile \
    && rm -f /usr/share/nginx/html/.dockerignore \
    && rm -rf /usr/share/nginx/html/docker-entrypoint.d

EXPOSE 80
