# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
RUN npm i -g npm@11
WORKDIR /app

# Copy only package.json first (no lockfile required)
COPY package.json ./

# Generate a lockfile deterministically, then install with npm ci
RUN npm install --package-lock-only && npm ci

# Now copy the full source and build
COPY . .

# Build args pour Vite
ARG VITE_API_BASE=http://localhost:8000
ARG VITE_API_URL=/api
ARG VITE_API_GEO=/api
ARG VITE_API_INFER=/api-infer
ARG VITE_API_OPTI=/api-opti

# Convertir ARG en ENV pour que Vite les voie
ENV VITE_API_BASE=${VITE_API_BASE}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_GEO=${VITE_API_GEO}
ENV VITE_API_INFER=${VITE_API_INFER}
ENV VITE_API_OPTI=${VITE_API_OPTI}

RUN npm run build

# Runtime
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ || exit 1
