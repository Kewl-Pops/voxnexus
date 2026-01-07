# =============================================================================
# VoxNexus Makefile
# =============================================================================
# MIT License - Copyright (c) 2024 VoxNexus Contributors
# =============================================================================
#
# Usage:
#   make setup     - Install all dependencies
#   make dev       - Run the full stack in development mode
#   make db        - Start database containers and run migrations
#   make test      - Run all tests
#   make clean     - Clean up all build artifacts and containers
#
# =============================================================================

.PHONY: all setup setup-node setup-python dev dev-web dev-worker db db-up db-down db-migrate db-push db-studio test test-web test-worker lint format clean help

# Default target
all: help

# =============================================================================
# Setup Commands
# =============================================================================

## setup: Install all dependencies (Node.js + Python)
setup: setup-node setup-python
	@echo "✓ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Copy .env.example to .env and configure your API keys"
	@echo "  2. Run 'make db' to start the database"
	@echo "  3. Run 'make dev' to start the development servers"

## setup-node: Install Node.js dependencies with pnpm
setup-node:
	@echo "→ Installing Node.js dependencies..."
	@if ! command -v pnpm &> /dev/null; then \
		echo "Installing pnpm..."; \
		npm install -g pnpm; \
	fi
	pnpm install
	@echo "✓ Node.js dependencies installed"

## setup-python: Install Python dependencies with uv
setup-python:
	@echo "→ Installing Python dependencies..."
	@if ! command -v uv &> /dev/null; then \
		echo "Installing uv..."; \
		curl -LsSf https://astral.sh/uv/install.sh | sh; \
	fi
	cd apps/worker && uv sync
	@echo "✓ Python dependencies installed"

# =============================================================================
# Development Commands
# =============================================================================

## dev: Run the full stack (web + worker) in development mode
dev:
	@echo "→ Starting VoxNexus development servers..."
	@trap 'kill 0' EXIT; \
	$(MAKE) dev-web & \
	$(MAKE) dev-worker & \
	wait

## dev-web: Run the Next.js web dashboard
dev-web:
	@echo "→ Starting Next.js web dashboard..."
	cd apps/web && pnpm dev

## dev-worker: Run the Python voice worker
dev-worker:
	@echo "→ Starting Python voice worker..."
	cd apps/worker && uv run python main.py

## dev-docs: Run the documentation server
dev-docs:
	@echo "→ Starting documentation server..."
	cd apps/docs && pnpm dev

# =============================================================================
# Database Commands
# =============================================================================

## db: Start database containers and run migrations
db: db-up db-migrate
	@echo "✓ Database ready!"

## db-up: Start PostgreSQL and Redis containers
db-up:
	@echo "→ Starting database containers..."
	docker compose up -d postgres redis
	@echo "→ Waiting for PostgreSQL to be ready..."
	@until docker compose exec -T postgres pg_isready -U voxnexus > /dev/null 2>&1; do \
		sleep 1; \
	done
	@echo "✓ Database containers running"

## db-down: Stop database containers
db-down:
	@echo "→ Stopping database containers..."
	docker compose down
	@echo "✓ Database containers stopped"

## db-migrate: Run Prisma migrations
db-migrate:
	@echo "→ Running database migrations..."
	cd packages/db && pnpm prisma migrate deploy
	@echo "✓ Migrations complete"

## db-push: Push Prisma schema to database (dev only)
db-push:
	@echo "→ Pushing schema to database..."
	cd packages/db && pnpm prisma db push
	@echo "✓ Schema pushed"

## db-studio: Open Prisma Studio
db-studio:
	@echo "→ Opening Prisma Studio..."
	cd packages/db && pnpm prisma studio

## db-seed: Seed the database with sample data
db-seed:
	@echo "→ Seeding database..."
	cd packages/db && pnpm prisma db seed
	@echo "✓ Database seeded"

## db-reset: Reset the database (WARNING: destroys all data)
db-reset:
	@echo "⚠️  WARNING: This will destroy all data!"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	@echo "→ Resetting database..."
	cd packages/db && pnpm prisma migrate reset --force
	@echo "✓ Database reset"

# =============================================================================
# Testing Commands
# =============================================================================

## test: Run all tests
test: test-web test-worker
	@echo "✓ All tests passed!"

## test-web: Run Next.js tests
test-web:
	@echo "→ Running web tests..."
	cd apps/web && pnpm test

## test-worker: Run Python worker tests
test-worker:
	@echo "→ Running worker tests..."
	cd apps/worker && uv run pytest

## test-e2e: Run end-to-end tests
test-e2e:
	@echo "→ Running E2E tests..."
	cd apps/web && pnpm test:e2e

# =============================================================================
# Code Quality Commands
# =============================================================================

## lint: Run linters on all code
lint:
	@echo "→ Running linters..."
	pnpm lint
	cd apps/worker && uv run ruff check .
	@echo "✓ Linting complete"

## format: Format all code
format:
	@echo "→ Formatting code..."
	pnpm format
	cd apps/worker && uv run ruff format .
	@echo "✓ Formatting complete"

## typecheck: Run type checking
typecheck:
	@echo "→ Running type checks..."
	pnpm typecheck
	cd apps/worker && uv run mypy .
	@echo "✓ Type checking complete"

# =============================================================================
# Build Commands
# =============================================================================

## build: Build all packages for production
build:
	@echo "→ Building for production..."
	pnpm build
	@echo "✓ Build complete"

## build-web: Build the Next.js web dashboard
build-web:
	@echo "→ Building web dashboard..."
	cd apps/web && pnpm build
	@echo "✓ Web dashboard built"

## build-docker: Build Docker images
build-docker:
	@echo "→ Building Docker images..."
	docker compose -f docker-compose.yml -f docker-compose.prod.yml build
	@echo "✓ Docker images built"

# =============================================================================
# Utility Commands
# =============================================================================

## clean: Remove all build artifacts and containers
clean:
	@echo "→ Cleaning up..."
	docker compose down -v --remove-orphans
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/web/.next
	rm -rf apps/worker/.venv
	rm -rf apps/worker/__pycache__
	rm -rf apps/worker/**/__pycache__
	@echo "✓ Cleanup complete"

## env: Copy .env.example to .env if it doesn't exist
env:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✓ Created .env from .env.example"; \
		echo "  Please edit .env and add your API keys"; \
	else \
		echo "→ .env already exists"; \
	fi

## generate: Generate Prisma client
generate:
	@echo "→ Generating Prisma client..."
	cd packages/db && pnpm prisma generate
	@echo "✓ Prisma client generated"

## health: Check health of all services
health:
	@echo "→ Checking service health..."
	@echo ""
	@echo "PostgreSQL:"
	@docker compose exec -T postgres pg_isready -U voxnexus 2>/dev/null && echo "  ✓ Running" || echo "  ✗ Not running"
	@echo ""
	@echo "Redis:"
	@docker compose exec -T redis redis-cli ping 2>/dev/null && echo "  ✓ Running" || echo "  ✗ Not running"
	@echo ""
	@echo "Worker:"
	@curl -s http://localhost:8081/health > /dev/null 2>&1 && echo "  ✓ Running" || echo "  ✗ Not running"
	@echo ""
	@echo "Web:"
	@curl -s http://localhost:3000 > /dev/null 2>&1 && echo "  ✓ Running" || echo "  ✗ Not running"

## logs: View logs from all containers
logs:
	docker compose logs -f

## logs-db: View database logs
logs-db:
	docker compose logs -f postgres

## logs-redis: View Redis logs
logs-redis:
	docker compose logs -f redis

# =============================================================================
# Help
# =============================================================================

## help: Show this help message
help:
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════════════╗"
	@echo "║                     VoxNexus Development                          ║"
	@echo "║              The WordPress for AI Voice Agents                    ║"
	@echo "╚═══════════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Quick Start:"
	@echo "  make setup    → Install all dependencies"
	@echo "  make env      → Create .env from template"
	@echo "  make db       → Start database & run migrations"
	@echo "  make dev      → Start development servers"
	@echo ""
	@echo "Available targets:"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /' | column -t -s ':'
	@echo ""
