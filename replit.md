# LeadForgeAI Authorization Module

## Overview
This is a minimal Express + Effect functional shell/core scaffold with Drizzle ORM schemas. The project follows strict functional programming principles with the **FUNCTIONAL CORE, IMPERATIVE SHELL** (FC/IS) architectural pattern.

### Purpose
Authorization module for LeadForgeAI with:
- Express.js HTTP server
- Effect-TS for functional effects and error handling
- Drizzle ORM for database schema management
- TypeScript with maximum type safety
- PostgreSQL database

### Current State
- **Status**: Development environment configured and running
- **Backend Server**: Running on port 3000 (localhost)
- **Database**: PostgreSQL (Replit-managed, development environment)
- **Dependencies**: Installed via npm

## Recent Changes

### 2025-11-26: Initial Replit Environment Setup
- Installed Node.js 20 runtime
- Created PostgreSQL database with environment variables
- Configured "Start Backend Server" workflow (npm run dev on port 3000)
- Enhanced .gitignore with Node.js and TypeScript patterns
- Created initial project documentation

## Project Architecture

### Technology Stack
- **Runtime**: Node.js 20
- **Language**: TypeScript 5.4+ (strict mode with exhaustive type checking)
- **Framework**: Express 4.x
- **Effects**: Effect-TS 3.x (monadic composition)
- **Validation**: @effect/schema 0.67.x
- **Database**: PostgreSQL via Drizzle ORM 0.44.x
- **Pattern Matching**: ts-pattern 5.x
- **Dev Server**: tsx (TypeScript executor)

### Directory Structure
```
src/
  app/
    server.ts          # Server entry point (SHELL)
  core/
    schema/            # Drizzle database schemas (CORE)
      identity.ts
      people.ts
      projects.ts
      security.ts
      time.ts
      index.ts
    health.ts          # Pure health check logic (CORE)
  shell/
    app.ts             # Express app creation (SHELL)

drizzle.config.ts      # Drizzle ORM configuration
tsconfig.json          # TypeScript strict configuration
package.json           # Dependencies and scripts
```

### Architectural Principles

This project follows strict functional programming guidelines documented in `AGENTS.md`:

1. **FUNCTIONAL CORE, IMPERATIVE SHELL (FC/IS)**:
   - CORE: Pure functions, immutable data, mathematical operations
   - SHELL: All effects (IO, network, database) isolated in thin wrapper
   - Strict separation: CORE never calls SHELL
   - Dependencies: SHELL → CORE (never reversed)

2. **Type Safety**:
   - No `any`, `unknown`, `eslint-disable`, `ts-ignore`, or `as` (except justified cases)
   - Exhaustive union type analysis via `.exhaustive()`
   - Errors typed in function signatures (no runtime exceptions)

3. **Monadic Composition**:
   - Effect-TS for all effects: `Effect<Success, Error, Requirements>`
   - Composition via `pipe()` and `Effect.flatMap()`
   - Dependency injection through Layer pattern

### Code Style Conventions

All code follows strict documentation standards:

```typescript
// CHANGE: <brief change description>
// WHY: <mathematical/architectural justification>
// QUOTE(ТЗ): "<literal requirement quote>"
// REF: <requirement ID or reference>
// FORMAT THEOREM: <∀x ∈ Domain: P(x) → Q(f(x))>
// PURITY: CORE | SHELL - explicit layer marking
// EFFECT: Effect<Success, Error, Requirements> - for shell functions
// INVARIANT: <mathematical function invariant>
// COMPLEXITY: O(time)/O(space) - temporal and spatial complexity
```

## Environment Configuration

### Database
- **Type**: PostgreSQL (Neon-backed, Replit-managed)
- **Environment**: Development
- **Connection**: DATABASE_URL environment variable (auto-configured)
- **Schema Location**: `src/core/schema/`
- **Migrations**: Drizzle Kit

### Environment Variables
All sensitive credentials managed by Replit as secrets:
- `DATABASE_URL` - PostgreSQL connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` - Individual PostgreSQL credentials
- `PORT` - Server port (defaults to 3000 in code)

## Available Scripts

```bash
# Development server (uses tsx for TypeScript execution)
npm run dev

# Linting
npm run lint              # Custom vibecode-linter
npm run lint:eslint       # ESLint check

# Formatting
npm run format            # Biome formatter

# Type checking
npm run check:types       # TypeScript noEmit check

# Database
npm run drizzle:generate  # Generate migrations
npm run drizzle:push      # Push schema to database
```

## Development Workflow

### Starting the Server
The workflow "Start Backend Server" runs automatically:
- Command: `npm run dev`
- Port: 3000 (backend/API only, no frontend)
- Output: Console logs

### Available Endpoints
- `GET /health` - Health check endpoint (returns status and timestamp)

### Database Schema Management
1. Define schemas in `src/core/schema/`
2. Generate migrations: `npm run drizzle:generate`
3. Push to database: `npm run drizzle:push`

## User Preferences
- Follows Russian-language documentation in AGENTS.md
- Strict mathematical and functional programming approach
- All functions documented with formal theorems and invariants
- Uses conventional commits with scope prefixes
- Property-based testing preferred for validation

## Dependencies Philosophy
- Effect-TS for monadic effects (no async/await)
- ts-pattern for exhaustive pattern matching
- @effect/schema for validation and schemas
- Drizzle ORM for type-safe database operations
- Express kept minimal (only in SHELL layer)

## Notes
- This is a backend-only service (no frontend)
- Server listens on localhost:3000 (internal)
- All business logic in CORE must remain pure
- HTTP/database concerns isolated in SHELL
- No mock data in production paths (use real database)
