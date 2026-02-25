# pg-inspect Specification

## Overview
Port of Python's schemainspect (https://github.com/djrobstep/schemainspect) to TypeScript.
Reference code is at /tmp/schemainspect/

## Goal
A TypeScript library that connects to a PostgreSQL database and inspects its schema, returning typed objects for all database objects.

## Architecture

```
src/
  index.ts          - Main entry, exports inspect()
  connection.ts     - PG connection handling (using 'pg' package)
  inspector.ts      - Main inspector class
  types.ts          - All TypeScript interfaces/types
  objects/
    tables.ts       - Table inspection
    views.ts        - View inspection  
    materialized.ts - Materialized view inspection
    columns.ts      - Column inspection
    indexes.ts      - Index inspection
    constraints.ts  - Constraint inspection (PK, FK, unique, check, exclusion)
    sequences.ts    - Sequence inspection
    enums.ts        - Enum inspection
    functions.ts    - Function inspection
    triggers.ts     - Trigger inspection
    extensions.ts   - Extension inspection
    schemas.ts      - Schema inspection
    privileges.ts   - Privilege inspection
    types.ts        - Custom type inspection
    domains.ts      - Domain inspection
    collations.ts   - Collation inspection
    rlspolicies.ts  - Row Level Security policies
    deps.ts         - Dependency tracking
  sql/              - Copy SQL files from /tmp/schemainspect/schemainspect/pg/sql/
  cli.ts            - CLI entry point
```

## Key Design Decisions

1. **Use `pg` (node-postgres)** - most popular, no ORM dependency
2. **Pure TypeScript** - no native dependencies
3. **SQL queries from original** - copy the SQL queries from schemainspect's .sql files, they work perfectly
4. **Typed results** - every database object has a proper TypeScript interface
5. **Connection string or pg.Pool** - accept either

## Main API

```typescript
import { inspect, PgInspector } from '@indiekit/pg-inspect';

// Simple usage
const schema = await inspect('postgresql://localhost/mydb');
// or
const schema = await inspect({ host: 'localhost', database: 'mydb' });

// Advanced: reuse connection
const inspector = new PgInspector(pool);
const schema = await inspector.inspect();
// Selective inspection
const tables = await inspector.tables();
const indexes = await inspector.indexes();
```

## Schema Result Interface

```typescript
interface InspectionResult {
  tables: Record<string, InspectedTable>;
  views: Record<string, InspectedView>;
  materializedViews: Record<string, InspectedMaterializedView>;
  indexes: Record<string, InspectedIndex>;
  constraints: Record<string, InspectedConstraint>;
  sequences: Record<string, InspectedSequence>;
  enums: Record<string, InspectedEnum>;
  functions: Record<string, InspectedFunction>;
  triggers: Record<string, InspectedTrigger>;
  extensions: Record<string, InspectedExtension>;
  schemas: string[];
  privileges: InspectedPrivilege[];
  types: Record<string, InspectedType>;
  domains: Record<string, InspectedDomain>;
  collations: Record<string, InspectedCollation>;
  rlsPolicies: Record<string, InspectedRLSPolicy>;
}
```

## Reference Files
- Python source: /tmp/schemainspect/schemainspect/
- Main logic: /tmp/schemainspect/schemainspect/pg/obj.py (1768 lines - the core)
- SQL queries: /tmp/schemainspect/schemainspect/pg/sql/*.sql (copy these)
- Types/models: /tmp/schemainspect/schemainspect/inspected.py
- Tests: /tmp/schemainspect/tests/

## CLI

```bash
# Inspect and output JSON
npx @indiekit/pg-inspect postgresql://localhost/mydb

# Specific objects
npx @indiekit/pg-inspect postgresql://localhost/mydb --tables
npx @indiekit/pg-inspect postgresql://localhost/mydb --indexes
npx @indiekit/pg-inspect postgresql://localhost/mydb --functions
```

## MCP Server (later)

Add MCP server support with tools: inspect, tables, indexes, functions, etc.

## Testing

Use the local PostgreSQL on this machine for testing:
```bash
PGPASSWORD="ees2TZXnJczvovUYc@RAXg" psql -h localhost -U tradeup_user -d ai_tradeup
```

Or create a test database:
```bash
sudo -u postgres createdb pg_inspect_test
```

Write tests with vitest.

## Package Setup

- TypeScript with tsup for building
- vitest for testing
- package.json with name "@indiekit/pg-inspect"
- bin entry for CLI
- ESM + CJS dual output

## Steps

1. Setup project (package.json, tsconfig, etc.)
2. Copy SQL files from reference
3. Implement connection handling
4. Implement types/interfaces
5. Port pg/obj.py logic to TypeScript (the core work)
6. Implement CLI
7. Write tests against real PG database
8. Make sure everything compiles and tests pass
