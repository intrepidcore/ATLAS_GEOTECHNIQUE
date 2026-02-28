# syntax=docker/dockerfile:1

ARG RUST_VERSION=1.86
FROM rust:${RUST_VERSION} as builder
ENV CARGO_TERM_COLOR=always
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
WORKDIR /app

# Pre-build to cache dependencies
RUN rustup component add rustfmt clippy

WORKDIR /app/services/api-geo
COPY services/api-geo/Cargo.toml ./
COPY services/api-geo/Cargo.lock ./
RUN mkdir -p src && echo "fn main(){}" > src/main.rs
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release || true

# Now copy real sources
WORKDIR /app
COPY dataset ./dataset
COPY services/api-geo ./services/api-geo
WORKDIR /app/services/api-geo
# Réactiver SQLX offline car la DB n'est pas accessible pendant le build Docker
# Les migrations seront appliquées au démarrage via sqlx::migrate!()
ENV SQLX_OFFLINE=true
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl fonts-dejavu-core fonts-liberation \
    && ln -sf /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf /usr/share/fonts/truetype/dejavu/DejaVuSans-Regular.ttf \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/services/api-geo/target/release/api-geo /usr/local/bin/api-geo
ENV RUST_LOG=info
EXPOSE 8000
CMD ["/usr/local/bin/api-geo"]
