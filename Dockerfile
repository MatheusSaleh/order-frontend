# syntax=docker/dockerfile:1.7
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# Imagem minima: Alpine atualizado + nginx do repositorio oficial do Alpine, sem root (porta 8080)
FROM alpine:3.24
RUN apk upgrade --no-cache \
 && apk add --no-cache nginx \
 && rm -f /etc/nginx/http.d/default.conf
COPY nginx.main.conf /etc/nginx/nginx.conf
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-e", "/dev/stderr", "-g", "daemon off;"]
