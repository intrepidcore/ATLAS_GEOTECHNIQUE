ARG RUST_VERSION=1.86
FROM rust:${RUST_VERSION} as builder
ENV CARGO_TERM_COLOR=always
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_BUILD_JOBS=1
WORKDIR /app

# Pre-build to cache dependencies
RUN rustup component add rustfmt clippy

COPY Cargo.toml ./
RUN mkdir -p src && echo "fn main(){}" > src/main.rs
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release || true

# Now copy real sources
COPY . .
# Réactiver SQLX offline car la DB n'est pas accessible pendant le build Docker
# Les migrations seront appliquées au démarrage via sqlx::migrate!()
ENV SQLX_OFFLINE=true
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release \
    && mkdir -p /out \
    && cp /app/target/release/api-geo /out/api-geo

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl fonts-dejavu-core fonts-liberation \
    python3 python3-pip python3-numpy python3-sklearn python3-psycopg2 \
    && pip3 install --no-cache-dir --break-system-packages 'PyKrige>=1.7.0' \
    && ln -sf /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf /usr/share/fonts/truetype/dejavu/DejaVuSans-Regular.ttf \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /out/api-geo /usr/local/bin/api-geo
ENV RUST_LOG=info
EXPOSE 8000
CMD ["/usr/local/bin/api-geo"]
