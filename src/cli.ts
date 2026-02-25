import { inspect } from './inspector.js';
import { startMcpServer } from './mcp.js';

function mapToObj(map: Map<string, any>): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const [k, v] of map) {
    obj[k] = serialize(v);
  }
  return obj;
}

function serialize(val: any): any {
  if (val instanceof Map) return mapToObj(val);
  if (Array.isArray(val)) return val.map(serialize);
  if (val && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'function' || k.startsWith('_')) continue;
      out[k] = serialize(v);
    }
    return out;
  }
  return val;
}

const HELP = `pg-inspect — PostgreSQL schema inspector

Usage:
  pg-inspect <connection-string> [options]
  pg-inspect --mcp                          Start MCP server

Connection:
  Provide a PostgreSQL connection string, or set DATABASE_URL.

  pg-inspect postgresql://user:pass@localhost/mydb
  DATABASE_URL=postgresql://localhost/mydb pg-inspect

Filter options:
  --tables       Tables only
  --views        Views only
  --functions    Functions only
  --indexes      Indexes only
  --sequences    Sequences only
  --enums        Enum types only
  --extensions   Extensions only
  --triggers     Triggers only
  --constraints  Constraints only
  --schemas      Schemas only
  --privileges   Privileges only
  --types        Composite types only
  --domains      Domains only
  --collations   Collations only
  --rls          RLS policies only

Output options:
  --json         JSON output (default)
  --summary      Summary counts only

Other:
  --mcp          Start as MCP server (stdio transport)
  -h, --help     Show this help
  -v, --version  Show version

Examples:
  # Full schema inspection
  pg-inspect postgresql://localhost/mydb

  # Tables and indexes only
  pg-inspect postgresql://localhost/mydb --tables --indexes

  # Quick summary
  pg-inspect postgresql://localhost/mydb --summary

  # Pipe to jq
  pg-inspect postgresql://localhost/mydb --enums | jq '.[]'

Exit codes:
  0  Success
  1  Connection or runtime error
  2  Usage error (bad arguments)
`;

async function main() {
  const args = process.argv.slice(2);

  // --version / -v
  if (args.includes('--version') || args.includes('-v')) {
    console.log('0.1.0');
    process.exit(0);
  }

  // --help / -h / no args
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  // --mcp mode
  if (args.includes('--mcp')) {
    await startMcpServer();
    return;
  }

  // Need connection string
  const connString = args.find(a => !a.startsWith('-')) || process.env.DATABASE_URL;
  if (!connString) {
    console.error('Error: No connection string provided. Use pg-inspect <connection-string> or set DATABASE_URL.\n');
    console.error('Run pg-inspect --help for usage.');
    process.exit(2);
  }

  const flags = new Set(args.filter(a => a.startsWith('-')));

  try {
    const result = await inspect(connString);

    if (flags.has('--summary')) {
      const summary: Record<string, number> = {};
      for (const [key, val] of Object.entries(result)) {
        if (val instanceof Map) summary[key] = val.size;
      }
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const filterMap: Record<string, keyof typeof result> = {
      '--tables': 'tables',
      '--views': 'views',
      '--functions': 'functions',
      '--indexes': 'indexes',
      '--sequences': 'sequences',
      '--enums': 'enums',
      '--extensions': 'extensions',
      '--triggers': 'triggers',
      '--constraints': 'constraints',
      '--schemas': 'schemas',
      '--privileges': 'privileges',
      '--types': 'types',
      '--domains': 'domains',
      '--collations': 'collations',
      '--rls': 'rlsPolicies',
    };

    let output: any;
    const activeFilters = Object.entries(filterMap).filter(([flag]) => flags.has(flag));

    if (activeFilters.length > 0) {
      output = {};
      for (const [, key] of activeFilters) {
        output[key] = mapToObj(result[key] as any);
      }
    } else {
      output = {};
      for (const [key, val] of Object.entries(result)) {
        if (val instanceof Map) {
          output[key] = mapToObj(val);
        }
      }
    }

    console.log(JSON.stringify(output, null, 2));
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === '28P01' || err.code === '3D000') {
      console.error(`Connection error: ${err.message}`);
    } else {
      console.error(`Error: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
