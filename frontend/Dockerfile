FROM node:24-alpine AS build

WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm run build

FROM nginx:stable-alpine

ENV BACKEND_HOST=backend \
    LLM_CHECKER_HOST=llm-checker \
    NGINX_ENVSUBST_FILTER='BACKEND_HOST|LLM_CHECKER_HOST'

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/templates/default.conf.template
COPY frontend/docker-entrypoint.d/10-write-config.sh /docker-entrypoint.d/10-write-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/10-write-config.sh \
    && chmod +x /docker-entrypoint.d/10-write-config.sh

EXPOSE 80
