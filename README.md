# @indiekit/pg-inspect

PostgreSQL schema inspection for TypeScript/Node.js.

Ported from Python's [schemainspect](https://github.com/djrobstep/schemainspect).

## Features

- Inspect tables, views, materialized views, constraints, indexes, sequences, enums, functions, extensions, triggers, and more
- Zero dependencies beyond `pg` (node-postgres)
- Full TypeScript types
- MCP Server support
- JSON output for CI/CD integration

## Install

```bash
npm install @indiekit/pg-inspect
```

## Quick Start

```typescript
import { inspect } from '@indiekit/pg-inspect';

const schema = await inspect('postgresql://localhost/mydb');

// Tables
console.log(schema.tables);

// Indexes
console.log(schema.indexes);

// Functions
console.log(schema.functions);
```

## License

MIT
