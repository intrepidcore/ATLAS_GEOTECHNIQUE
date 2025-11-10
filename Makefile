.PHONY: up down logs build db-migrate seed fmt lint rebuild-api-geo

COMPOSE=docker compose

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down -v

logs:
	$(COMPOSE) logs -f --tail=200

build:
	$(COMPOSE) build --no-cache

db-migrate:
	$(COMPOSE) exec -T db psql -U $$POSTGRES_USER -d $$POSTGRES_DB -f /docker-entrypoint-initdb.d/init.sql

seed:
	$(COMPOSE) run --rm etl etl load-sample

fmt:
	# Rust format (uses official Rust image as a tooling container)
	docker run --rm -v $(PWD)/services/api-geo:/work -w /work rust:1.79 cargo fmt --all -- --check || true
	docker run --rm -v $(PWD)/services/api-infer:/work -w /work rust:1.79 cargo fmt --all -- --check || true
	docker run --rm -v $(PWD)/services/api-opti:/work -w /work rust:1.79 cargo fmt --all -- --check || true
	# UI format with Node
	docker run --rm -v $(PWD)/ui:/work -w /work node:20 sh -lc "npm ci && npm run format" || true

lint:
	docker run --rm -v $(PWD)/services/api-geo:/work -w /work rust:1.79 sh -lc "rustup component add clippy && cargo clippy -- -D warnings" || true
	docker run --rm -v $(PWD)/services/api-infer:/work -w /work rust:1.79 sh -lc "rustup component add clippy && cargo clippy -- -D warnings" || true
	docker run --rm -v $(PWD)/services/api-opti:/work -w /work rust:1.79 sh -lc "rustup component add clippy && cargo clippy -- -D warnings" || true

rebuild-api-geo:
	@echo "🔄 Rebuild propre de api-geo..."
	$(COMPOSE) down api-geo
	-docker image rm $$(docker images -q '*api-geo*') 2>/dev/null || true
	$(COMPOSE) build --no-cache api-geo
	$(COMPOSE) up -d api-geo
	@echo "✅ api-geo redémarré, vérification des logs..."
	$(COMPOSE) logs -f api-geo

sqlx-prepare:
	@echo "📦 Préparation des queries SQLx..."
	cd services/api-geo && cargo sqlx prepare -- --lib
	@echo "✅ Fichiers .sqlx générés et prêts à commit"

test-staging:
	@echo "🧪 Tests d'intégration staging..."
	cd services/api-geo && cargo test --test db_manager_tests -- --nocapture

check-migrations:
	@echo "🔍 Vérification des migrations..."
	@for file in migrations/*.sql; do \
		echo "Checking $$file..."; \
		grep -q "IF NOT EXISTS\|IF EXISTS" $$file || echo "⚠️  $$file n'est pas idempotent"; \
	done
