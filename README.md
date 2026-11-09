# Pharmacy POS

The project is currently in Phase 1: local technical foundation.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop

## Local Setup

```bash
copy .env.example .env
npm install
docker compose up -d
npm run db:generate
npm run db:migrate --workspace @pharmacy-pos/api -- --name init
npm run db:seed
npm run dev
```

To include the optional local S3-compatible storage service:

```bash
docker compose --profile storage up -d
```

The web application runs at `http://localhost:5173`.

The API health endpoint is available at `http://localhost:3000/api/health`.

Swagger documentation is available at `http://localhost:3000/api/docs`.

When the storage profile is enabled, MinIO is available at `http://localhost:9001`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
