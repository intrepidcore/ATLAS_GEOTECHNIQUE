ARG RUST_VERSION=1.86
FROM rust:${RUST_VERSION} as builder
ENV CARGO_TERM_COLOR=always
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
# CARGO_BUILD_JOBS=1 était trop conservateur — laisser Cargo utiliser les coeurs dispo
# (le build Docker n'est pas OOM sur une machine 28Go RAM)
WORKDIR /app

# Pre-build to cache dependencies
RUN rustup component add rustfmt clippy

COPY Cargo.toml Cargo.lock ./
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

# ARCH-GPU-01 : Dépendances ML baked dans l'image — BuildKit cache évite le re-téléchargement
# (~2GB au premier build, ~10s ensuite grâce au cache pip BuildKit)
# tensorflow[and-cuda] embarque les libs CUDA pour GPU RTX 2050
RUN --mount=type=cache,target=/root/.cache/pip \
    pip3 install --break-system-packages \
    pandas==2.0.3 \
    scikit-learn==1.3.2 \
    'tensorflow[and-cuda]>=2.15,<2.16' \
    gpflow==2.10.1

WORKDIR /app
COPY --from=builder /out/api-geo /usr/local/bin/api-geo
ENV RUST_LOG=info
EXPOSE 8000
CMD ["/usr/local/bin/api-geo"]
