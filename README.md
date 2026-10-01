# Domain Suite MCP

TypeScript MCP (Model Context Protocol) server, packaged as `complete-tech-domain-suite-mcp`, for domain discovery, registrar comparison, AI-style scoring, and guarded domain registration.

## Contents

- `src/` - server code (`server.ts`, `tools.ts`, `scoring.ts`, `domain-utils.ts`, caching, config).
- `src/providers/` - provider adapters for Cloudflare, Namecheap, Porkbun, and RDAP.
- `skills/domain-buyer/` - an agent skill (`SKILL.md`) for using the tools.
- `.env.example` - the configuration keys the server reads (registrar credentials, host and port, default TLDs, purchase mode).

## Run

```bash
npm install
cp .env.example .env   # fill in registrar credentials locally; never commit .env
npm run build
npm start              # stdio transport
npm run start:http     # HTTP transport
```

`npm run dev` and `npm run dev:http` run from source with `tsx`; `npm run typecheck` checks types.

## Status

Version 0.1.0. Registration is gated by the `DOMAIN_PURCHASE_MODE` setting.
