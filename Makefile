# @nqlib/nqgrid — npm publish shortcuts
# Usage:
#   make login
#   make verify          # optional — publish runs verify:publish via prepublishOnly
#   make publish
#   make publish OTP=123456   # when npm asks for 2FA

REGISTRY := https://registry.npmjs.com
PKG_DIR  := .
PKG_NAME := @nqlib/nqgrid

.PHONY: help login whoami verify publish version

help:
	@echo "nqgrid npm publish"
	@echo ""
	@echo "  make login              npm web login (opens browser)"
	@echo "  make whoami             show logged-in npm user"
	@echo "  make version            local package.json vs npm latest"
	@echo "  make verify             build + lint + test + pack check"
	@echo "  make publish            publish $(PKG_NAME) (runs verify via prepublishOnly)"
	@echo "  make publish OTP=CODE   publish with 2FA one-time password"
	@echo ""
	@echo "See .cursor/commands/publish.md"

login:
	npm login --auth-type=web --registry=$(REGISTRY)

whoami:
	@npm whoami --registry=$(REGISTRY) 2>/dev/null || \
		(echo "Not logged in. Run: make login" && exit 1)

version:
	@echo "local:  $$(node -p "require('./package.json').version")"
	@echo "npm:    $$(npm view $(PKG_NAME) version --registry=$(REGISTRY) 2>/dev/null || echo '(not published)')"

verify:
	pnpm verify:publish

publish: whoami
ifdef OTP
	NPM_OTP=$(OTP) pnpm publish:npm
else
	pnpm publish:npm
endif
