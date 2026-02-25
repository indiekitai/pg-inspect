import pg from 'pg';
import { quotedIdentifier, resourceText } from './utils.js';
import {
  ColumnInfo,
  InspectedSelectable,
  InspectedFunction,
  InspectedTrigger,
  InspectedIndex,
  InspectedSequence,
  InspectedCollation,
  InspectedEnum,
  InspectedSchema,
  InspectedType,
  InspectedDomain,
  InspectedExtension,
  InspectedConstraint,
  InspectedPrivilege,
  InspectedRowPolicy,
  type InspectionResult,
} from './types.js';

const { Pool, Client } = pg;

// Load SQL queries
const ALL_RELATIONS_QUERY = resourceText('sql/relations.sql');
const ALL_RELATIONS_QUERY_9 = resourceText('sql/relations9.sql');
const SCHEMAS_QUERY = resourceText('sql/schemas.sql');
const INDEXES_QUERY = resourceText('sql/indexes.sql');
const SEQUENCES_QUERY = resourceText('sql/sequences.sql');
const CONSTRAINTS_QUERY = resourceText('sql/constraints.sql');
const FUNCTIONS_QUERY = resourceText('sql/functions.sql');
const TYPES_QUERY = resourceText('sql/types.sql');
const DOMAINS_QUERY = resourceText('sql/domains.sql');
const EXTENSIONS_QUERY = resourceText('sql/extensions.sql');
const ENUMS_QUERY = resourceText('sql/enums.sql');
const DEPS_QUERY = resourceText('sql/deps.sql');
const PRIVILEGES_QUERY = resourceText('sql/privileges.sql');
const TRIGGERS_QUERY = resourceText('sql/triggers.sql');
const COLLATIONS_QUERY = resourceText('sql/collations.sql');
const COLLATIONS_QUERY_9 = resourceText('sql/collations9.sql');
const RLSPOLICIES_QUERY = resourceText('sql/rlspolicies.sql');

function processQuery(q: string, pgVersion: number, includeInternal: boolean): string {
  if (!includeInternal) {
    q = q.replace(/-- SKIP_INTERNAL/g, '');
  }
  if (pgVersion >= 11) {
    q = q.replace(/-- 11_AND_LATER/g, '');
  } else {
    q = q.replace(/-- 10_AND_EARLIER/g, '');
  }
  // For node-postgres, replace \: with :
  q = q.replace(/\\:/g, ':');
  return q;
}

/** PostgreSQL connection configuration — either a connection string or a pg.PoolConfig object. */
export type ConnectionConfig = string | pg.PoolConfig;

/**
 * PostgreSQL schema inspector.
 *
 * Introspects a PostgreSQL database and returns structured, typed objects
 * representing tables, views, indexes, functions, constraints, and more.
 *
 * @example
 * ```typescript
 * const inspector = new PgInspector('postgresql://localhost/mydb');
 * const schema = await inspector.inspect();
 * console.log(schema.tables);
 * await inspector.close();
 * ```
 */
export class PgInspector {
  private client: pg.Pool | pg.Client;
  private ownsConnection: boolean;
  private includeInternal: boolean;

  // Results
  schemas = new Map<string, InspectedSchema>();
  tables = new Map<string, InspectedSelectable>();
  views = new Map<string, InspectedSelectable>();
  materializedViews = new Map<string, InspectedSelectable>();
  compositeTypes = new Map<string, InspectedSelectable>();
  relations = new Map<string, InspectedSelectable>();
  selectables = new Map<string, InspectedSelectable | InspectedFunction>();
  indexes = new Map<string, InspectedIndex>();
  sequences = new Map<string, InspectedSequence>();
  constraints = new Map<string, InspectedConstraint>();
  enums = new Map<string, InspectedEnum>();
  functions = new Map<string, InspectedFunction>();
  triggers = new Map<string, InspectedTrigger>();
  extensions = new Map<string, InspectedExtension>();
  privileges = new Map<string, InspectedPrivilege>();
  types = new Map<string, InspectedType>();
  domains = new Map<string, InspectedDomain>();
  collations = new Map<string, InspectedCollation>();
  rlsPolicies = new Map<string, InspectedRowPolicy>();

  private pgVersion = 0;

  constructor(clientOrConfig: pg.Pool | pg.Client | ConnectionConfig, opts?: { includeInternal?: boolean }) {
    this.includeInternal = opts?.includeInternal ?? false;
    if (clientOrConfig instanceof Pool || clientOrConfig instanceof Client) {
      this.client = clientOrConfig;
      this.ownsConnection = false;
    } else if (typeof clientOrConfig === 'string' || (typeof clientOrConfig === 'object' && clientOrConfig !== null)) {
      this.client = new Pool(typeof clientOrConfig === 'string' ? { connectionString: clientOrConfig } : clientOrConfig);
      this.ownsConnection = true;
    } else {
      throw new Error('Invalid connection config');
    }
  }

  private async execute(query: string): Promise<Record<string, any>[]> {
    const result = await this.client.query(query);
    return result.rows;
  }

  private q(query: string): string {
    return processQuery(query, this.pgVersion, this.includeInternal);
  }

  async inspect(): Promise<InspectionResult> {
    // Get PG version
    const versionResult = await this.execute('SHOW server_version');
    const versionStr = versionResult[0].server_version;
    this.pgVersion = parseInt(versionStr.split('.')[0], 10);

    await this.loadSchemas();
    await this.loadAllRelations();
    await this.loadFunctions();

    this.selectables = new Map<string, InspectedSelectable | InspectedFunction>();
    for (const [k, v] of this.relations) this.selectables.set(k, v);
    for (const [k, v] of this.compositeTypes) this.selectables.set(k, v);
    for (const [k, v] of this.functions) this.selectables.set(k, v);

    await this.loadPrivileges();
    await this.loadTriggers();
    await this.loadCollations();
    await this.loadRlsPolicies();
    await this.loadTypes();
    await this.loadDomains();
    await this.loadDeps();

    return {
      schemas: this.schemas,
      tables: this.tables,
      views: this.views,
      materializedViews: this.materializedViews,
      compositeTypes: this.compositeTypes,
      relations: this.relations,
      selectables: this.selectables,
      indexes: this.indexes,
      sequences: this.sequences,
      constraints: this.constraints,
      enums: this.enums,
      functions: this.functions,
      triggers: this.triggers,
      extensions: this.extensions,
      privileges: this.privileges,
      types: this.types,
      domains: this.domains,
      collations: this.collations,
      rlsPolicies: this.rlsPolicies,
    };
  }

  async close(): Promise<void> {
    if (this.ownsConnection && this.client instanceof Pool) {
      await this.client.end();
    }
  }

  private async loadSchemas(): Promise<void> {
    const rows = await this.execute(this.q(SCHEMAS_QUERY));
    this.schemas = new Map();
    for (const row of rows) {
      const s = new InspectedSchema(row.schema);
      this.schemas.set(s.schema, s);
    }
  }

  private async loadAllRelations(): Promise<void> {
    this.tables = new Map();
    this.views = new Map();
    this.materializedViews = new Map();
    this.compositeTypes = new Map();

    // Load enums first
    const enumRows = await this.execute(this.q(ENUMS_QUERY));
    this.enums = new Map();
    for (const row of enumRows) {
      const e = new InspectedEnum(row.name, row.schema, row.elements, this.pgVersion);
      this.enums.set(e.quotedFullName, e);
    }

    // Load relations
    let relQuery: string;
    if (this.pgVersion <= 9) {
      relQuery = this.q(ALL_RELATIONS_QUERY_9);
    } else {
      let q = ALL_RELATIONS_QUERY;
      if (this.pgVersion >= 12) {
        q = q.replace(/-- 12_ONLY/g, '');
      } else {
        q = q.replace(/-- PRE_12/g, '');
      }
      relQuery = this.q(q);
    }

    const relRows = await this.execute(relQuery);

    // Group by (relationtype, schema, name)
    const groups = new Map<string, Record<string, any>[]>();
    for (const row of relRows) {
      const key = `${row.relationtype}|${row.schema}|${row.name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    for (const [, clist] of groups) {
      const f = clist[0];

      const getEnum = (name: string | null, schema: string | null): InspectedEnum | null => {
        if (!name && !schema) return null;
        const qfn = `${quotedIdentifier(schema)}.${quotedIdentifier(name)}`;
        return this.enums.get(qfn) ?? null;
      };

      const columns = new Map<string, ColumnInfo>();
      for (const c of clist) {
        if (!c.position_number) continue;
        const col = new ColumnInfo({
          name: c.attname,
          dbtype: c.datatype,
          dbtypestr: c.datatypestring,
          pytype: null,
          default: c.defaultdef,
          notNull: c.not_null,
          isEnum: c.is_enum,
          enum: getEnum(c.enum_name, c.enum_schema),
          collation: c.collation,
          isIdentity: c.is_identity,
          isIdentityAlways: c.is_identity_always,
          isGenerated: c.is_generated,
          canDropGenerated: this.pgVersion >= 13,
        });
        columns.set(col.name, col);
      }

      const s = new InspectedSelectable({
        name: f.name,
        schema: f.schema,
        columns,
        relationtype: f.relationtype,
        definition: f.definition,
        comment: f.comment,
        parentTable: f.parent_table,
        partitionDef: f.partition_def,
        rowsecurity: f.rowsecurity,
        forcerowsecurity: f.forcerowsecurity,
        persistence: f.persistence,
      });

      const RELATIONTYPES: Record<string, string> = {
        r: 'tables', v: 'views', m: 'materializedViews', c: 'compositeTypes', p: 'tables',
      };
      const att = RELATIONTYPES[f.relationtype];
      if (att === 'tables') this.tables.set(s.quotedFullName, s);
      else if (att === 'views') this.views.set(s.quotedFullName, s);
      else if (att === 'materializedViews') this.materializedViews.set(s.quotedFullName, s);
      else if (att === 'compositeTypes') this.compositeTypes.set(s.quotedFullName, s);
    }

    // Mark inherited columns
    for (const [, t] of this.tables) {
      if (t.isInheritanceChildTable && t.parentTable) {
        const parent = this.tables.get(t.parentTable);
        if (parent) {
          for (const [cname, c] of t.columns) {
            if (parent.columns.has(cname)) {
              c.isInherited = true;
            }
          }
        }
      }
    }

    // Build relations
    this.relations = new Map();
    for (const [k, v] of this.tables) this.relations.set(k, v);
    for (const [k, v] of this.views) this.relations.set(k, v);
    for (const [k, v] of this.materializedViews) this.relations.set(k, v);

    // Load indexes
    const idxRows = await this.execute(this.q(INDEXES_QUERY));
    this.indexes = new Map();
    for (const i of idxRows) {
      const idx = new InspectedIndex({
        name: i.name,
        schema: i.schema,
        definition: i.definition,
        tableName: i.table_name,
        keyColumns: i.key_columns ?? [],
        indexColumns: i.index_columns ?? [],
        includedColumns: i.included_columns ?? [],
        keyOptions: i.key_options ?? [],
        numAtt: i.num_att,
        isUnique: i.is_unique,
        isPk: i.is_pk,
        isExclusion: i.is_exclusion,
        isImmediate: i.is_immediate,
        isClustered: i.is_clustered,
        keyCollations: i.key_collations ?? [],
        keyExpressions: i.key_expressions,
        partialPredicate: i.partial_predicate,
        algorithm: i.algorithm,
      });
      this.indexes.set(idx.quotedFullName, idx);
    }

    // Load sequences
    const seqRows = await this.execute(this.q(SEQUENCES_QUERY));
    this.sequences = new Map();
    for (const i of seqRows) {
      const seq = new InspectedSequence(i.name, i.schema, i.table_name, i.column_name);
      this.sequences.set(seq.quotedFullName, seq);
    }

    // Load constraints
    const conRows = await this.execute(this.q(CONSTRAINTS_QUERY));
    this.constraints = new Map();
    for (const i of conRows) {
      const constraint = new InspectedConstraint({
        name: i.name,
        schema: i.schema,
        constraintType: i.constraint_type,
        tableName: i.table_name,
        definition: i.definition,
        index: i.index,
        isFk: i.is_fk,
        isDeferrable: i.is_deferrable,
        initiallyDeferred: i.initially_deferred,
      });

      if (constraint.index && typeof constraint.index === 'string') {
        const indexName = quotedIdentifier(constraint.index, i.schema);
        const index = this.indexes.get(indexName);
        if (index) {
          index.constraint = constraint;
          constraint.index = index;
        }
      }

      if (constraint.isFk) {
        constraint.quotedFullForeignTableName = quotedIdentifier(
          i.foreign_table_name, i.foreign_table_schema
        );
        constraint.fkColumnsForeign = i.fk_columns_foreign;
        constraint.fkColumnsLocal = i.fk_columns_local;
      }

      this.constraints.set(constraint.quotedFullName, constraint);
    }

    // Load extensions
    const extRows = await this.execute(this.q(EXTENSIONS_QUERY));
    this.extensions = new Map();
    for (const i of extRows) {
      const ext = new InspectedExtension(i.name, i.schema, i.version);
      this.extensions.set(ext.name, ext);
    }

    // Add indexes and constraints to each relation
    for (const each of this.indexes.values()) {
      const t = each.quotedFullTableName;
      const rel = this.relations.get(t);
      if (rel) rel.indexes.set(each.quotedFullName, each);
    }
    for (const each of this.constraints.values()) {
      const t = each.quotedFullTableName;
      const rel = this.relations.get(t);
      if (rel) rel.constraints.set(each.quotedFullName, each);
    }
  }

  private async loadFunctions(): Promise<void> {
    this.functions = new Map();
    const rows = await this.execute(this.q(FUNCTIONS_QUERY));

    // Group by (schema, name, identity_arguments)
    const groups = new Map<string, Record<string, any>[]>();
    for (const row of rows) {
      const key = `${row.schema}|${row.name}|${row.identity_arguments}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    for (const [, clist] of groups) {
      const f = clist[0];
      const outs = clist.filter(c => c.parameter_mode === 'OUT');
      let columns: ColumnInfo[];
      if (outs.length > 0) {
        columns = outs.map(c => new ColumnInfo({
          name: c.parameter_name,
          dbtype: c.data_type,
          pytype: null,
        }));
      } else {
        columns = [new ColumnInfo({
          name: f.name,
          dbtype: f.data_type,
          pytype: null,
          default: f.parameter_default,
        })];
      }

      const plist = clist
        .filter(c => c.parameter_mode === 'IN')
        .map(c => new ColumnInfo({
          name: c.parameter_name,
          dbtype: c.data_type,
          pytype: null,
          default: c.parameter_default,
        }));

      const fn = new InspectedFunction({
        schema: f.schema,
        name: f.name,
        columns: new Map(columns.map(c => [c.name, c])),
        inputs: plist,
        identityArguments: f.identity_arguments,
        resultString: f.result_string,
        language: f.language,
        definition: f.definition,
        strictness: f.strictness,
        securityType: f.security_type,
        volatility: f.volatility,
        fullDefinition: f.full_definition,
        comment: f.comment,
        returntype: f.returntype,
        kind: f.kind,
      });

      const identityArguments = `(${fn.identityArguments})`;
      this.functions.set(fn.quotedFullName + identityArguments, fn);
    }
  }

  private async loadTriggers(): Promise<void> {
    const rows = await this.execute(this.q(TRIGGERS_QUERY));
    this.triggers = new Map();
    for (const i of rows) {
      const t = new InspectedTrigger(
        i.name, i.schema, i.table_name,
        i.proc_schema, i.proc_name, i.enabled,
        i.full_definition
      );
      this.triggers.set(t.signature, t);
    }
  }

  private async loadPrivileges(): Promise<void> {
    const rows = await this.execute(this.q(PRIVILEGES_QUERY));
    this.privileges = new Map();
    for (const i of rows) {
      const p = new InspectedPrivilege(i.object_type, i.schema, i.name, i.privilege, i.user);
      this.privileges.set(p.key, p);
    }
  }

  private async loadCollations(): Promise<void> {
    const query = this.pgVersion <= 9 ? COLLATIONS_QUERY_9 : COLLATIONS_QUERY;
    const rows = await this.execute(this.q(query));
    this.collations = new Map();
    for (const i of rows) {
      const c = new InspectedCollation(
        i.name, i.schema, i.provider, i.encoding,
        i.lc_collate, i.lc_ctype, i.version
      );
      this.collations.set(c.quotedFullName, c);
    }
  }

  private async loadRlsPolicies(): Promise<void> {
    if (this.pgVersion <= 9) {
      this.rlsPolicies = new Map();
      return;
    }
    const rows = await this.execute(this.q(RLSPOLICIES_QUERY));
    this.rlsPolicies = new Map();
    for (const p of rows) {
      const rp = new InspectedRowPolicy(
        p.name, p.schema, p.table_name,
        p.commandtype, p.permissive, p.roles,
        p.qual, p.withcheck
      );
      this.rlsPolicies.set(rp.key, rp);
    }
  }

  private async loadTypes(): Promise<void> {
    const rows = await this.execute(this.q(TYPES_QUERY));
    this.types = new Map();
    for (const i of rows) {
      const cols = new Map<string, string>();
      if (Array.isArray(i.columns)) {
        for (const defn of i.columns) {
          cols.set(defn.attribute, defn.type);
        }
      }
      const t = new InspectedType(i.name, i.schema, cols);
      this.types.set(t.signature, t);
    }
  }

  private async loadDomains(): Promise<void> {
    const rows = await this.execute(this.q(DOMAINS_QUERY));
    this.domains = new Map();
    for (const i of rows) {
      const d = new InspectedDomain(
        i.name, i.schema, i.data_type, i.collation,
        i.constraint_name, i.not_null, i.default, i.check
      );
      this.domains.set(d.signature, d);
    }
  }

  private async loadDeps(): Promise<void> {
    const rows = await this.execute(this.q(DEPS_QUERY));

    for (const dep of rows) {
      const x = quotedIdentifier(dep.name, dep.schema, dep.identity_arguments);
      const xDep = quotedIdentifier(
        dep.name_dependent_on, dep.schema_dependent_on, dep.identity_arguments_dependent_on
      );

      const selectable = this.selectables.get(x);
      if (selectable && 'dependentOn' in selectable) {
        (selectable as InspectedSelectable).dependentOn.push(xDep);
        (selectable as InspectedSelectable).dependentOn.sort();
      }

      const depOn = this.selectables.get(xDep);
      if (depOn && 'dependents' in depOn) {
        (depOn as InspectedSelectable).dependents.push(x);
        (depOn as InspectedSelectable).dependents.sort();
      }
    }

    // Add trigger deps
    for (const [k, t] of this.triggers) {
      for (const depName of t.dependentOn) {
        const dependency = this.selectables.get(depName);
        if (dependency && 'dependents' in dependency) {
          (dependency as InspectedSelectable).dependents.push(k);
        }
      }
    }

    // Add enum deps
    for (const [k, r] of this.relations) {
      for (const [, c] of r.columns) {
        if (c.isEnum && c.enum) {
          const eSig = c.enum.signature;
          if (this.enums.has(eSig)) {
            r.dependentOn.push(eSig);
            c.enum.dependents.push(k);
          }
        }
      }
      if (r.parentTable) {
        const pt = this.relations.get(r.parentTable);
        if (pt) {
          r.dependentOn.push(r.parentTable);
          pt.dependents.push(r.signature);
        }
      }
    }
  }
}

/**
 * Inspect a PostgreSQL database schema.
 *
 * Convenience function that creates a {@link PgInspector}, runs inspection,
 * and closes the connection.
 *
 * @param config - Connection string or pg.PoolConfig
 * @param opts - Options (e.g. `{ includeInternal: true }` to include system schemas)
 * @returns Structured inspection result with all schema objects
 *
 * @example
 * ```typescript
 * const schema = await inspect('postgresql://localhost/mydb');
 * for (const [name, table] of schema.tables) {
 *   console.log(name, table.columns.size, 'columns');
 * }
 * ```
 */
export async function inspect(config: ConnectionConfig, opts?: { includeInternal?: boolean }): Promise<InspectionResult> {
  const inspector = new PgInspector(config, opts);
  try {
    return await inspector.inspect();
  } finally {
    await inspector.close();
  }
}
