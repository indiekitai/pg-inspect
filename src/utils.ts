import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export function quotedIdentifier(
  identifier: string | null,
  schema?: string | null,
  identityArguments?: string | null
): string {
  if (identifier === null && schema != null) {
    return `"${schema.replace(/"/g, '""')}"`;
  }
  let s = `"${(identifier ?? '').replace(/"/g, '""')}"`;
  if (schema) {
    s = `"${schema.replace(/"/g, '""')}".${s}`;
  }
  if (identityArguments != null) {
    s = `${s}(${identityArguments})`;
  }
  return s;
}

export function unquotedIdentifier(
  identifier: string | null,
  schema?: string | null,
  identityArguments?: string | null
): string {
  if (identifier === null && schema != null) {
    return schema;
  }
  let s = `${identifier ?? ''}`;
  if (schema) {
    s = `${schema}.${s}`;
  }
  if (identityArguments != null) {
    s = `${s}(${identityArguments})`;
  }
  return s;
}

let _sqlDir: string;

function getSqlDir(): string {
  if (!_sqlDir) {
    // Try multiple resolution strategies
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      _sqlDir = join(__dirname, '..', 'src', 'sql');
      // Check if it exists, otherwise try dist-relative
      try {
        readFileSync(join(_sqlDir, 'schemas.sql'));
      } catch {
        _sqlDir = join(__dirname, 'sql');
      }
    } catch {
      _sqlDir = join(__dirname, 'sql');
    }
  }
  return _sqlDir;
}

export function resourceText(subpath: string): string {
  const sqlDir = getSqlDir();
  const filename = subpath.replace('sql/', '');
  return readFileSync(join(sqlDir, filename), 'utf-8');
}
