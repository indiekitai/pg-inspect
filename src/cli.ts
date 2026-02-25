import { inspect } from './inspector.js';

function mapToObj(map: Map<string, any>): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const [k, v] of map) {
    if (v instanceof Map) {
      obj[k] = mapToObj(v);
    } else if (v && typeof v === 'object' && !(v instanceof Array)) {
      obj[k] = serializeObj(v);
    } else {
      obj[k] = v;
    }
  }
  return obj;
}

function serializeObj(val: any): any {
  if (val instanceof Map) return mapToObj(val);
  if (Array.isArray(val)) return val.map(serializeObj);
  if (val && typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'function') continue;
      if (k.startsWith('_')) continue;
      out[k] = serializeObj(v);
    }
    return out;
  }
  return val;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: pg-inspect <connection-string> [options]

Options:
  --tables       Show only tables
  --views        Show only views
  --functions    Show only functions
  --indexes      Show only indexes
  --sequences    Show only sequences
  --enums        Show only enums
  --extensions   Show only extensions
  --triggers     Show only triggers
  --constraints  Show only constraints
  --schemas      Show only schemas
  --privileges   Show only privileges
  --types        Show only types
  --domains      Show only domains
  --collations   Show only collations
  --rls          Show only RLS policies
  --json         Output as JSON (default)
  --summary      Show summary counts only
`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const connString = args[0];
  const flags = new Set(args.slice(1));

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
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
