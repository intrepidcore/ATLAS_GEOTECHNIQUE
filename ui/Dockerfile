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
RUN npm run build

# Runtime
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ || exit 1
