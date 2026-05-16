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

## Available Scripts

- `npm run start:dev` - start NestJS in watch mode
- `npm run build` - compile the application
- `npm run lint` - run ESLint with fixes
- `npm test` - run Jest tests
- `npm run prisma:validate` - validate `prisma/schema.prisma`
- `npm run prisma:migrate` - create/apply a local Prisma migration
- `npm run prisma:generate` - generate Prisma Client
- `npm run prisma:studio` - open Prisma Studio

## Current Scope

This repository currently contains only the NestJS foundation:

- Global configuration module
- Global validation pipe
- Standard API response envelope
- Global exception filter
- Swagger/OpenAPI at `/api/docs`
- Health endpoint at `/api/v1/health`

Auth, Prisma migrations, inventory, sales orders, invoices, payments, and other business modules are intentionally not implemented yet.

## Project Documentation

- [Requirement & Planning v3](docs/requirement-planning-v3.md)
- [API Contract v1](docs/api-contract-v1.md)
- [Codex Implementation Backlog v1](docs/codex-backlog-v1.md)
- [Prisma Schema Notes v1](docs/prisma-schema-notes-v1.md)
