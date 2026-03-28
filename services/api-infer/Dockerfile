# syntax=docker/dockerfile:1

ARG RUST_VERSION=1.86
FROM rust:${RUST_VERSION} AS builder
ENV CARGO_TERM_COLOR=always
WORKDIR /app
RUN rustup component add rustfmt clippy
COPY Cargo.toml ./
RUN mkdir -p src && echo "fn main(){}" > src/main.rs
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release || true
COPY . .
# Le cache target n’est pas dans la couche image : copier le binaire vers un chemin persistant du builder.
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release \
    && install -m 755 /app/target/release/api-infer /opt/api-infer

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
    python3 python3-numpy python3-sklearn python3-psycopg2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /opt/api-infer /usr/local/bin/api-infer
ENV RUST_LOG=info
ENV API_INFER_PORT=8000
EXPOSE 8000
CMD ["/usr/local/bin/api-infer"]
