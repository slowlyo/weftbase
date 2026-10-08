.PHONY: dev server web build

dev:
	$(MAKE) -j2 server web

server:
	cd server && WEFTBASE_AUTOMIGRATE=1 air

web:
	cd web && pnpm dev

build:
	cd web && pnpm build
	cd server && CGO_ENABLED=0 go build -o ../bin/weftbase ./cmd/weftbase
