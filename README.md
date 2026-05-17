# CoreERP API

SaaS-ready multi-tenant ERP backend for Vietnamese SMBs.

## Tech Stack

- Node.js + TypeScript
- NestJS
- PostgreSQL
- Prisma
- Docker Compose
- Swagger/OpenAPI
- Jest

## Architecture

CoreERP is built as a modular monolith. The MVP will focus on the Order-to-Cash workflow, but this foundation does not implement business modules yet.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Start the development server:

   ```bash
   npm run start:dev
   ```

   On Windows PowerShell, if script execution policy blocks `npm`, use:

   ```powershell
   npm.cmd run start:dev
   ```

4. Open Swagger UI:

   ```text
   http://localhost:3000/api/docs
   ```

5. Check service health:

   ```text
   GET http://localhost:3000/api/v1/health
   ```

## Database Setup

Start PostgreSQL with Docker Compose:

```bash
docker compose up -d
```

Create a local environment file:

```bash
cp .env.example .env
```

Validate the Prisma schema:

```bash
npm run prisma:validate
```

Run database migrations:

```bash
npm run prisma:migrate
```

For future schema changes, pass a migration name, for example `npm run prisma:migrate -- --name add_next_feature`.

Generate Prisma Client:

```bash
npm run prisma:generate
```

Open Prisma Studio:

```bash
npm run prisma:studio
```

Seed local demo tenants and users:

```bash
npm run db:seed
```

## Demo Accounts

All demo accounts use password `123456`. These accounts are for local development only.

| tenantCode | email | role |
|---|---|---|
| minh-anh-retail | admin@minhanh.vn | TENANT_ADMIN |
| minh-anh-retail | sales@minhanh.vn | SALES |
| minh-anh-retail | warehouse@minhanh.vn | WAREHOUSE |
| minh-anh-retail | finance@minhanh.vn | FINANCE |
| minh-anh-retail | viewer@minhanh.vn | VIEWER |
| hoang-long-fashion | admin@hoanglong.vn | TENANT_ADMIN |
| hoang-long-fashion | sales@hoanglong.vn | SALES |
| hoang-long-fashion | warehouse@hoanglong.vn | WAREHOUSE |
| hoang-long-fashion | finance@hoanglong.vn | FINANCE |
| hoang-long-fashion | viewer@hoanglong.vn | VIEWER |

Login with `POST /api/v1/auth/login`, then call `GET /api/v1/me` with `Authorization: Bearer <accessToken>`.

## Available Scripts

- `npm run start:dev` - start NestJS in watch mode
- `npm run build` - compile the application
- `npm run lint` - run ESLint with fixes
- `npm test` - run Jest tests
- `npm run prisma:validate` - validate `prisma/schema.prisma`
- `npm run prisma:migrate` - create/apply a local Prisma migration
- `npm run prisma:generate` - generate Prisma Client
- `npm run prisma:studio` - open Prisma Studio
- `npm run db:seed` - seed local demo tenants and users

## Current Scope

This repository currently contains the NestJS foundation plus PostgreSQL/Prisma infrastructure:

- Global configuration module
- Global validation pipe
- Standard API response envelope
- Global exception filter
- Swagger/OpenAPI at `/api/docs`
- Health endpoint at `/api/v1/health`
- PostgreSQL Docker Compose setup
- Prisma schema, migration, client generation, and local demo seed

Auth, RBAC, inventory, sales orders, invoices, payments, and other business APIs are intentionally not implemented yet.

## Project Documentation

- [Requirement & Planning v3](docs/CoreERP_MVP_Requirement_Planning_v3_Notion.md)
- [API Contract v1](docs/CoreERP_API_Contract_v1.md)
- [Codex Implementation Backlog v1](docs/CoreERP_Codex_Implementation_Backlog_v1.md)
- [Prisma Schema v1](docs/CoreERP_Prismeschema_v1.prisma)
- [Prisma Schema Notes v1](docs/CoreERP_Prismeschema_v1_notes.md)
