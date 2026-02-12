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
	$(COMPOSE) exec -T db sh -lc 'set -e; for f in /docker-entrypoint-initdb.d/*.sql; do echo "[db-migrate] applying $$f"; psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -f "$$f"; done'

db-migrate-init:
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

test-integration:
	@echo "🧪 Tests d'intégration complets..."
	cd services/api-geo && cargo test --test db_manager_tests -- --ignored --test-threads=1 --nocapture

check-migrations:
	@echo "🔍 Vérification des migrations..."
	@for file in migrations/*.sql; do \
		echo "Checking $$file..."; \
		grep -q "IF NOT EXISTS\\|IF EXISTS" $$file || echo "⚠️  $$file n'est pas idempotent"; \
	done

backup-db:
	@echo "💾 Backup de la base de données..."
	@powershell -ExecutionPolicy Bypass -File scripts/backup_db.ps1

backup-db-encrypted:
	@echo "🔐 Backup chiffré de la base de données..."
	@powershell -ExecutionPolicy Bypass -File scripts/backup_db.ps1 -Encrypt

restore-db:
	@echo "⚠️  Restore de la base de données..."
	@powershell -ExecutionPolicy Bypass -File scripts/restore_db.ps1

wait-db:
	@echo "⏳ Attente de la base de données..."
	@bash scripts/wait-for-db.sh 30

metrics:
	@echo "📊 Vérification de l'endpoint /metrics..."
	@curl -s http://localhost:8000/metrics | head -20

health:
	@echo "🏥 Vérification de l'endpoint /healthz..."
	@curl -s http://localhost:8000/healthz | jq .
