import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { PgInspector, type InspectionResult } from './index.js';

const connConfig = {
  host: 'localhost',
  user: 'postgres',
  password: 'postgres',
  database: 'pg_inspect_test',
};

describe('PgInspector', () => {
  let pool: pg.Pool;
  let result: InspectionResult;

  beforeAll(async () => {
    pool = new pg.Pool(connConfig);
    const inspector = new PgInspector(pool);
    result = await inspector.inspect();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should load schemas', () => {
    expect(result.schemas.size).toBeGreaterThan(0);
    expect(result.schemas.has('public')).toBe(true);
  });

  it('should load tables', () => {
    expect(result.tables.size).toBeGreaterThan(0);
    // Check that tables have columns
    for (const [, table] of result.tables) {
      expect(table.name).toBeTruthy();
      expect(table.schema).toBeTruthy();
    }
  });

  it('should load indexes', () => {
    expect(result.indexes.size).toBeGreaterThan(0);
    for (const [, idx] of result.indexes) {
      expect(idx.name).toBeTruthy();
      expect(idx.tableName).toBeTruthy();
    }
  });

  it('should load constraints', () => {
    expect(result.constraints.size).toBeGreaterThan(0);
  });

  it('should load sequences', () => {
    // May or may not have sequences
    expect(result.sequences).toBeDefined();
  });

  it('should load extensions', () => {
    expect(result.extensions).toBeDefined();
  });

  it('should load functions', () => {
    expect(result.functions).toBeDefined();
  });

  it('should load triggers', () => {
    expect(result.triggers).toBeDefined();
  });

  it('should have table columns with proper types', () => {
    // Find a table with columns
    const firstTable = [...result.tables.values()][0];
    expect(firstTable).toBeDefined();
    expect(firstTable.columns.size).toBeGreaterThan(0);

    const firstCol = [...firstTable.columns.values()][0];
    expect(firstCol.name).toBeTruthy();
    expect(firstCol.dbtype).toBeTruthy();
  });

  it('should generate create statements for tables', () => {
    const firstTable = [...result.tables.values()][0];
    const stmt = firstTable.createStatement;
    expect(stmt).toContain('create');
    expect(stmt).toContain('table');
  });

  it('should generate drop statements for tables', () => {
    const firstTable = [...result.tables.values()][0];
    const stmt = firstTable.dropStatement;
    expect(stmt).toContain('drop table');
  });

  it('should work with connection string', async () => {
    const connStr = `postgresql://${connConfig.user}:${connConfig.password}@${connConfig.host}/${connConfig.database}`;
    const inspector = new PgInspector(connStr);
    const r = await inspector.inspect();
    expect(r.tables.size).toBeGreaterThan(0);
    await inspector.close();
  });

  it('should load collations', () => {
    expect(result.collations).toBeDefined();
  });

  it('should load privileges', () => {
    expect(result.privileges).toBeDefined();
  });

  it('should load types', () => {
    expect(result.types).toBeDefined();
  });

  it('should load domains', () => {
    expect(result.domains).toBeDefined();
  });

  it('should load rls policies', () => {
    expect(result.rlsPolicies).toBeDefined();
  });
});
