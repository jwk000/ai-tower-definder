# Tower Defender — Build & Release Makefile
# Usage: make [target]

.PHONY: help dev build clean release preview install test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

dev: ## Start dev server (http://localhost:3000)
	npm run dev

build: ## Type-check and build for production
	npm run build

clean: ## Remove build artifacts
	npm run clean

release: ## Full release build (typecheck + clean + build)
	npm run release

preview: ## Preview production build locally
	npm run release:preview

test: ## Run unit tests
	npm test

typecheck: ## TypeScript type checking only
	npm run typecheck
