FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
COPY apps/api/src/common/contracts.ts apps/api/src/common/contracts.ts
RUN npm run build -w apps/web
FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html
EXPOSE 8080
