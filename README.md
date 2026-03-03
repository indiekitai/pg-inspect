[English](README.md) | [中文](README.zh-CN.md)

# @indiekit/pg-inspect

[![npm version](https://img.shields.io/npm/v/@indiekit/pg-inspect.svg)](https://www.npmjs.com/package/@indiekit/pg-inspect)
[![license](https://img.shields.io/npm/l/@indiekit/pg-inspect.svg)](https://github.com/indiekitai/pg-inspect/blob/main/LICENSE)

**PostgreSQL schema inspector for TypeScript/Node.js** — a complete TypeScript port of Python's [schemainspect](https://github.com/djrobstep/schemainspect).

Introspect your entire PostgreSQL schema into structured, typed objects. Built for schema diffing, code generation, migration tools, and AI agents.

## Features

- **Complete schema inspection** — tables, views, materialized views, indexes, constraints, functions, triggers, sequences, enums, extensions, domains, collations, RLS policies, privileges, and composite types
- **Full TypeScript types** — every object is strongly typed with exported classes and interfaces
- **DDL generation** — `createStatement` and `dropStatement` on every inspected object
- **Dependency tracking** — knows which views depend on which tables
- **MCP Server** — expose schema inspection to AI agents via Model Context Protocol
- **CLI with JSON output** — pipe to `jq`, feed to scripts, integrate into CI/CD
- **Zero dependencies** beyond `pg` (node-postgres)
- **PostgreSQL 9–17** support

## Install

```bash
npm install @indiekit/pg-inspect
```

## API Usage

### Full inspection

```typescript
import { inspect } from '@indiekit/pg-inspect';

const schema = await inspect('postgresql://user:pass@localhost/mydb');

// Everything is a Map keyed by quoted full name
schema.tables;           // Map<string, InspectedSelectable>
schema.views;            // Map<string, InspectedSelectable>
schema.indexes;          // Map<string, InspectedIndex>
schema.functions;        // Map<string, InspectedFunction>
schema.constraints;      // Map<string, InspectedConstraint>
schema.enums;            // Map<string, InspectedEnum>
schema.sequences;        // Map<string, InspectedSequence>
schema.triggers;         // Map<string, InspectedTrigger>
schema.extensions;       // Map<string, InspectedExtension>
schema.privileges;       // Map<string, InspectedPrivilege>
schema.types;            // Map<string, InspectedType>
schema.domains;          // Map<string, InspectedDomain>
schema.collations;       // Map<string, InspectedCollation>
schema.rlsPolicies;      // Map<string, InspectedRowPolicy>
```

### Working with results

```typescript
// Iterate tables
for (const [name, table] of schema.tables) {
  console.log(name, table.columns.size, 'columns');

  // Column details
  for (const [colName, col] of table.columns) {
    console.log(`  ${colName}: ${col.dbtype} ${col.notNull ? 'NOT NULL' : ''}`);
  }

  // Generate DDL
  console.log(table.createStatement);
  console.log(table.dropStatement);
}

// Check dependencies
for (const [name, view] of schema.views) {
  console.log(`${name} depends on:`, view.dependentOn);
}
```

### Connection options

```typescript
import { inspect, PgInspector } from '@indiekit/pg-inspect';

// Connection string
const schema = await inspect('postgresql://user:pass@localhost:5432/mydb');

// Config object
const schema = await inspect({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'secret',
  database: 'mydb',
});

// Existing pg.Pool or pg.Client
import pg from 'pg';
const pool = new pg.Pool({ connectionString: '...' });
const inspector = new PgInspector(pool);
const schema = await inspector.inspect();
await inspector.close();

// Include internal/system schemas
const schema = await inspect('postgresql://localhost/mydb', {
  includeInternal: true,
});
```

## CLI

```bash
# Full inspection (JSON output)
pg-inspect postgresql://localhost/mydb

# Filter by object type
pg-inspect postgresql://localhost/mydb --tables
pg-inspect postgresql://localhost/mydb --tables --indexes --constraints

# Summary counts
pg-inspect postgresql://localhost/mydb --summary

# Use DATABASE_URL
export DATABASE_URL=postgresql://localhost/mydb
pg-inspect --tables

# Pipe to jq
pg-inspect postgresql://localhost/mydb --enums | jq 'to_entries[] | .value.elements'

# Version
pg-inspect --version
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Connection or runtime error |
| 2 | Usage error (missing arguments) |

## MCP Server

pg-inspect includes a built-in [Model Context Protocol](https://modelcontextprotocol.io) server for AI agent integration.

### Setup

Add to your MCP client config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "pg-inspect": {
      "command": "npx",
      "args": ["@indiekit/pg-inspect", "--mcp"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/mydb"
      }
    }
  }
}
```

Or run directly:

```bash
DATABASE_URL=postgresql://localhost/mydb pg-inspect --mcp
```

### Available tools

| Tool | Description |
|------|-------------|
| `inspect` | Summary counts of all schema objects |
| `tables` | All tables with columns, types, defaults |
| `indexes` | All indexes with definitions and properties |
| `functions` | All functions/procedures with signatures |
| `constraints` | All constraints (PK, FK, unique, check, exclusion) |
| `enums` | All enum types with values |
| `views` | All views and materialized views |
| `sequences` | All sequences |
| `triggers` | All triggers with definitions |

Each tool accepts an optional `connectionString` parameter (defaults to `DATABASE_URL`).

## Comparison with Python schemainspect

| | **@indiekit/pg-inspect** | **schemainspect** (Python) |
|---|---|---|
| Language | TypeScript/Node.js | Python |
| Types | Full TypeScript types | No type hints |
| CLI | Built-in with JSON output | None |
| MCP Server | Built-in | None |
| DDL generation | ✅ create/drop statements | ✅ create/drop statements |
| Dependencies | Only `pg` | `sqlalchemy`, `psycopg2` |
| Schema coverage | Tables, views, matviews, indexes, constraints, functions, triggers, sequences, enums, extensions, domains, collations, RLS, privileges, composite types | Same |
| PG versions | 9–17 | 9–15 |

This is a faithful port — same SQL queries, same object model, same coverage — but native to the Node.js ecosystem with TypeScript types, CLI, and MCP support.

## License

MIT
