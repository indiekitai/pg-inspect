import { quotedIdentifier } from './utils.js';

// ── Column Info ──

export class ColumnInfo {
  name: string;
  dbtype: string;
  dbtypestr: string;
  pytype: string | null;
  default: string | null;
  notNull: boolean;
  isEnum: boolean;
  enum: InspectedEnum | null;
  collation: string | null;
  isIdentity: boolean;
  isIdentityAlways: boolean;
  isGenerated: boolean;
  isInherited: boolean;
  canDropGenerated: boolean;

  constructor(opts: {
    name: string;
    dbtype: string;
    dbtypestr?: string;
    pytype?: string | null;
    default?: string | null;
    notNull?: boolean;
    isEnum?: boolean;
    enum?: InspectedEnum | null;
    collation?: string | null;
    isIdentity?: boolean;
    isIdentityAlways?: boolean;
    isGenerated?: boolean;
    isInherited?: boolean;
    canDropGenerated?: boolean;
  }) {
    this.name = opts.name || '';
    this.dbtype = opts.dbtype;
    this.dbtypestr = opts.dbtypestr || opts.dbtype;
    this.pytype = opts.pytype ?? null;
    this.default = opts.default || null;
    this.notNull = opts.notNull ?? false;
    this.isEnum = opts.isEnum ?? false;
    this.enum = opts.enum ?? null;
    this.collation = opts.collation ?? null;
    this.isIdentity = opts.isIdentity ?? false;
    this.isIdentityAlways = opts.isIdentityAlways ?? false;
    this.isGenerated = opts.isGenerated ?? false;
    this.isInherited = opts.isInherited ?? false;
    this.canDropGenerated = opts.canDropGenerated ?? false;
  }

  get quotedName(): string {
    return quotedIdentifier(this.name);
  }

  get creationClause(): string {
    let x = `${this.quotedName} ${this.dbtypestr}`;
    if (this.isIdentity) {
      const identityType = this.isIdentityAlways ? 'always' : 'by default';
      x += ` generated ${identityType} as identity`;
    }
    if (this.notNull) {
      x += ' not null';
    }
    if (this.isGenerated) {
      x += ` generated always as (${this.default}) stored`;
    } else if (this.default) {
      x += ` default ${this.default}`;
    }
    return x;
  }

  get collationSubclause(): string {
    if (this.collation) {
      return ` collate ${quotedIdentifier(this.collation)}`;
    }
    return '';
  }

  equals(other: ColumnInfo): boolean {
    return (
      this.name === other.name &&
      this.dbtype === other.dbtype &&
      this.dbtypestr === other.dbtypestr &&
      this.default === other.default &&
      this.notNull === other.notNull &&
      this.enum === other.enum &&
      this.collation === other.collation &&
      this.isIdentity === other.isIdentity &&
      this.isIdentityAlways === other.isIdentityAlways &&
      this.isGenerated === other.isGenerated &&
      this.isInherited === other.isInherited
    );
  }
}

// ── Base Inspected ──

export abstract class Inspected {
  name!: string;
  schema!: string;

  get quotedFullName(): string {
    return quotedIdentifier(this.name, this.schema);
  }

  get signature(): string {
    return this.quotedFullName;
  }

  get unquotedFullName(): string {
    return `${this.schema}.${this.name}`;
  }

  get quotedName(): string {
    return quotedIdentifier(this.name);
  }

  get quotedSchema(): string {
    return quotedIdentifier(this.schema);
  }
}

// ── Selectable (table/view/matview/composite) ──

export class InspectedSelectable extends Inspected {
  name: string;
  schema: string;
  columns: Map<string, ColumnInfo>;
  inputs: ColumnInfo[];
  definition: string | null;
  relationtype: string;
  dependentOn: string[];
  dependents: string[];
  dependentOnAll: string[];
  dependentsAll: string[];
  constraints: Map<string, InspectedConstraint>;
  indexes: Map<string, InspectedIndex>;
  comment: string | null;
  parentTable: string | null;
  partitionDef: string | null;
  rowsecurity: boolean;
  forcerowsecurity: boolean;
  persistence: string | null;

  constructor(opts: {
    name: string;
    schema: string;
    columns: Map<string, ColumnInfo>;
    inputs?: ColumnInfo[];
    definition?: string | null;
    dependentOn?: string[];
    dependents?: string[];
    comment?: string | null;
    relationtype?: string;
    parentTable?: string | null;
    partitionDef?: string | null;
    rowsecurity?: boolean;
    forcerowsecurity?: boolean;
    persistence?: string | null;
  }) {
    super();
    this.name = opts.name;
    this.schema = opts.schema;
    this.columns = opts.columns;
    this.inputs = opts.inputs ?? [];
    this.definition = opts.definition ?? null;
    this.relationtype = opts.relationtype ?? 'unknown';
    this.dependentOn = opts.dependentOn ?? [];
    this.dependents = opts.dependents ?? [];
    this.dependentOnAll = [];
    this.dependentsAll = [];
    this.constraints = new Map();
    this.indexes = new Map();
    this.comment = opts.comment ?? null;
    this.parentTable = opts.parentTable ?? null;
    this.partitionDef = opts.partitionDef ?? null;
    this.rowsecurity = opts.rowsecurity ?? false;
    this.forcerowsecurity = opts.forcerowsecurity ?? false;
    this.persistence = opts.persistence ?? null;
  }

  get persistenceModifier(): string {
    if (this.persistence === 't') return 'temporary ';
    if (this.persistence === 'u') return 'unlogged ';
    return '';
  }

  get isUnlogged(): boolean {
    return this.persistence === 'u';
  }

  get isPartitioned(): boolean {
    return this.relationtype === 'p';
  }

  get isTable(): boolean {
    return this.relationtype === 'r' || this.relationtype === 'p';
  }

  get isInheritanceChildTable(): boolean {
    return !!this.parentTable && !this.partitionDef;
  }

  get isPartitioningChildTable(): boolean {
    return this.relationtype === 'r' && !!this.parentTable && !!this.partitionDef;
  }

  get isAlterable(): boolean {
    return this.isTable && (!this.parentTable || this.isInheritanceChildTable);
  }

  get containsData(): boolean {
    return this.relationtype === 'r' && (!!this.parentTable || !this.partitionDef);
  }

  get usesPartitioning(): boolean {
    return this.isPartitioningChildTable || this.isPartitioned;
  }

  hasCompatibleColumns(other: InspectedSelectable): boolean {
    const namesAndTypes = (cols: Map<string, ColumnInfo>) =>
      [...cols.entries()].map(([k, c]) => `${k}:${c.dbtype}`);
    let items = namesAndTypes(this.columns);
    if (this.relationtype !== 'f') {
      items = items.slice(0, other.columns.size);
    }
    return JSON.stringify(items) === JSON.stringify(namesAndTypes(other.columns));
  }

  canReplace(other: InspectedSelectable): boolean {
    if (!(this.relationtype === 'v' || this.relationtype === 'f' || this.isTable)) return false;
    if (this.signature !== other.signature) return false;
    if (this.relationtype !== other.relationtype) return false;
    return this.hasCompatibleColumns(other);
  }

  get createStatement(): string {
    const n = this.quotedFullName;
    if (this.relationtype === 'r' || this.relationtype === 'p') {
      if (!this.isPartitioningChildTable) {
        let colspec = [...this.columns.values()].map(c => '    ' + c.creationClause).join(',\n');
        if (colspec) colspec = '\n' + colspec;
        let partitionKey = '';
        let inheritsClause = '';
        if (this.partitionDef) {
          partitionKey = ' partition by ' + this.partitionDef;
        } else if (this.parentTable) {
          inheritsClause = ` inherits (${this.parentTable})`;
        }
        return `create ${this.persistenceModifier}table ${n} (${colspec}\n)${partitionKey}${inheritsClause};\n`;
      } else {
        return `create ${this.persistenceModifier}table ${n} partition of ${this.parentTable} ${this.partitionDef};\n`;
      }
    } else if (this.relationtype === 'v') {
      return `create or replace view ${n} as ${this.definition}\n`;
    } else if (this.relationtype === 'm') {
      return `create materialized view ${n} as ${this.definition}\n`;
    } else if (this.relationtype === 'c') {
      const colspec = [...this.columns.values()].map(c => c.creationClause).join(', ');
      return `create type ${n} as (${colspec});`;
    }
    throw new Error('Not implemented');
  }

  get dropStatement(): string {
    const n = this.quotedFullName;
    if (this.relationtype === 'r' || this.relationtype === 'p') return `drop table ${n};`;
    if (this.relationtype === 'v') return `drop view if exists ${n};`;
    if (this.relationtype === 'm') return `drop materialized view if exists ${n};`;
    if (this.relationtype === 'c') return `drop type ${n};`;
    throw new Error('Not implemented');
  }

  alterTableStatement(clause: string): string {
    if (this.isAlterable) {
      return `alter table ${this.quotedFullName} ${clause};`;
    }
    throw new Error('Not implemented');
  }

  get alterRlsStatement(): string {
    const keyword = this.rowsecurity ? 'enable' : 'disable';
    return this.alterTableStatement(`${keyword} row level security`);
  }

  get alterUnloggedStatement(): string {
    const keyword = this.isUnlogged ? 'unlogged' : 'logged';
    return this.alterTableStatement(`set ${keyword}`);
  }

  equals(other: InspectedSelectable): boolean {
    const colsEqual = () => {
      const a = [...this.columns.entries()];
      const b = [...other.columns.entries()];
      if (a.length !== b.length) return false;
      return a.every(([k, v], i) => k === b[i][0] && v.equals(b[i][1]));
    };
    return (
      this.constructor === other.constructor &&
      this.relationtype === other.relationtype &&
      this.name === other.name &&
      this.schema === other.schema &&
      colsEqual() &&
      JSON.stringify(this.inputs) === JSON.stringify(other.inputs) &&
      this.definition === other.definition &&
      this.parentTable === other.parentTable &&
      this.partitionDef === other.partitionDef &&
      this.rowsecurity === other.rowsecurity &&
      this.persistence === other.persistence
    );
  }
}

// ── Function ──

export class InspectedFunction extends InspectedSelectable {
  identityArguments: string;
  resultString: string;
  language: string;
  volatility: string;
  strictness: string;
  securityType: string;
  fullDefinition: string;
  returntype: string;
  kind: string;

  constructor(opts: {
    name: string;
    schema: string;
    columns: Map<string, ColumnInfo>;
    inputs: ColumnInfo[];
    definition: string | null;
    identityArguments: string;
    resultString: string;
    language: string;
    volatility: string;
    strictness: string;
    securityType: string;
    fullDefinition: string;
    comment?: string | null;
    returntype: string;
    kind: string;
  }) {
    super({
      name: opts.name,
      schema: opts.schema,
      columns: opts.columns,
      inputs: opts.inputs,
      definition: opts.definition,
      relationtype: 'f',
      comment: opts.comment,
    });
    this.identityArguments = opts.identityArguments;
    this.resultString = opts.resultString;
    this.language = opts.language;
    this.volatility = opts.volatility;
    this.strictness = opts.strictness;
    this.securityType = opts.securityType;
    this.fullDefinition = opts.fullDefinition;
    this.returntype = opts.returntype;
    this.kind = opts.kind;
  }

  get signature(): string {
    return `${this.quotedFullName}(${this.identityArguments})`;
  }

  get createStatement(): string {
    return this.fullDefinition + ';';
  }

  get thing(): string {
    const kinds: Record<string, string> = { f: 'function', p: 'procedure', a: 'aggregate', w: 'window function' };
    return kinds[this.kind] ?? 'function';
  }

  get dropStatement(): string {
    return `drop ${this.thing} if exists ${this.signature};`;
  }

  equals(other: InspectedFunction): boolean {
    return (
      this.signature === other.signature &&
      this.resultString === other.resultString &&
      this.definition === other.definition &&
      this.language === other.language &&
      this.volatility === other.volatility &&
      this.strictness === other.strictness &&
      this.securityType === other.securityType &&
      this.kind === other.kind
    );
  }
}

// ── Trigger ──

export class InspectedTrigger extends Inspected {
  name: string;
  schema: string;
  tableName: string;
  procSchema: string;
  procName: string;
  enabled: string;
  fullDefinition: string;
  dependentOn: string[];
  dependents: string[];

  constructor(
    name: string, schema: string, tableName: string,
    procSchema: string, procName: string, enabled: string,
    fullDefinition: string
  ) {
    super();
    this.name = name;
    this.schema = schema;
    this.tableName = tableName;
    this.procSchema = procSchema;
    this.procName = procName;
    this.enabled = enabled;
    this.fullDefinition = fullDefinition;
    this.dependentOn = [this.quotedFullSelectableName];
    this.dependents = [];
  }

  get signature(): string {
    return this.quotedFullName;
  }

  get quotedFullName(): string {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}.${quotedIdentifier(this.name)}`;
  }

  get quotedFullSelectableName(): string {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}`;
  }

  get dropStatement(): string {
    return `drop trigger if exists "${this.name}" on "${this.schema}"."${this.tableName}";`;
  }

  get createStatement(): string {
    const statusSql: Record<string, string> = {
      O: 'ENABLE TRIGGER',
      D: 'DISABLE TRIGGER',
      R: 'ENABLE REPLICA TRIGGER',
      A: 'ENABLE ALWAYS TRIGGER',
    };
    if (['D', 'R', 'A'].includes(this.enabled)) {
      const s = quotedIdentifier(this.schema);
      const t = quotedIdentifier(this.tableName);
      const tn = quotedIdentifier(this.name);
      return `${this.fullDefinition};\nALTER TABLE ${s}.${t} ${statusSql[this.enabled]} ${tn};`;
    }
    return this.fullDefinition + ';';
  }
}

// ── Index ──

export class InspectedIndex extends Inspected {
  name: string;
  schema: string;
  definition: string | null;
  tableName: string;
  keyColumns: string[];
  keyOptions: string[];
  numAtt: number;
  isUnique: boolean;
  isPk: boolean;
  isExclusion: boolean;
  isImmediate: boolean;
  isClustered: boolean;
  keyCollations: string[];
  keyExpressions: string | null;
  partialPredicate: string | null;
  algorithm: string;
  constraint: InspectedConstraint | null;
  indexColumns: string[] | null;
  includedColumns: string[] | null;

  constructor(opts: {
    name: string;
    schema: string;
    tableName: string;
    keyColumns: string[];
    keyOptions: string[];
    numAtt: number;
    isUnique: boolean;
    isPk: boolean;
    isExclusion: boolean;
    isImmediate: boolean;
    isClustered: boolean;
    keyCollations: string[];
    keyExpressions: string | null;
    partialPredicate: string | null;
    algorithm: string;
    definition?: string | null;
    constraint?: InspectedConstraint | null;
    indexColumns?: string[] | null;
    includedColumns?: string[] | null;
  }) {
    super();
    this.name = opts.name;
    this.schema = opts.schema;
    this.tableName = opts.tableName;
    this.keyColumns = opts.keyColumns;
    this.keyOptions = opts.keyOptions;
    this.numAtt = opts.numAtt;
    this.isUnique = opts.isUnique;
    this.isPk = opts.isPk;
    this.isExclusion = opts.isExclusion;
    this.isImmediate = opts.isImmediate;
    this.isClustered = opts.isClustered;
    this.keyCollations = opts.keyCollations;
    this.keyExpressions = opts.keyExpressions;
    this.partialPredicate = opts.partialPredicate;
    this.algorithm = opts.algorithm;
    this.definition = opts.definition ?? null;
    this.constraint = opts.constraint ?? null;
    this.indexColumns = opts.indexColumns ?? null;
    this.includedColumns = opts.includedColumns ?? null;
  }

  get quotedFullTableName(): string {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}`;
  }

  get dropStatement(): string {
    const stmt = `drop index if exists ${this.quotedFullName};`;
    if (this.isExclusionConstraint) return 'select 1; -- ' + stmt;
    return stmt;
  }

  get createStatement(): string {
    const stmt = `${this.definition};`;
    if (this.isExclusionConstraint) return 'select 1; -- ' + stmt;
    return stmt;
  }

  get isExclusionConstraint(): boolean {
    return !!this.constraint && this.constraint.constraintType === 'EXCLUDE';
  }
}

// ── Sequence ──

export class InspectedSequence extends Inspected {
  name: string;
  schema: string;
  tableName: string | null;
  columnName: string | null;

  constructor(name: string, schema: string, tableName?: string | null, columnName?: string | null) {
    super();
    this.name = name;
    this.schema = schema;
    this.tableName = tableName ?? null;
    this.columnName = columnName ?? null;
  }

  get quotedFullTableName(): string | null {
    if (this.tableName != null) return quotedIdentifier(this.tableName, this.schema);
    return null;
  }

  get quotedTableAndColumnName(): string | null {
    if (this.columnName != null && this.tableName != null) {
      return this.quotedFullTableName + '.' + quotedIdentifier(this.columnName);
    }
    return null;
  }

  get dropStatement(): string {
    return `drop sequence if exists ${this.quotedFullName};`;
  }

  get createStatement(): string {
    return `create sequence ${this.quotedFullName};`;
  }
}

// ── Collation ──

export class InspectedCollation extends Inspected {
  name: string;
  schema: string;
  provider: string;
  encoding: string;
  lcCollate: string;
  lcCtype: string;
  version: string | null;

  constructor(name: string, schema: string, provider: string, encoding: string, lcCollate: string, lcCtype: string, version: string | null) {
    super();
    this.name = name;
    this.schema = schema;
    this.provider = provider;
    this.encoding = encoding;
    this.lcCollate = lcCollate;
    this.lcCtype = lcCtype;
    this.version = version;
  }

  get locale(): string {
    return this.lcCollate;
  }

  get dropStatement(): string {
    return `drop collation if exists ${this.quotedFullName};`;
  }

  get createStatement(): string {
    return `create collation if not exists ${this.quotedFullName} (provider = '${this.provider}', locale = '${this.locale}');`;
  }
}

// ── Enum ──

export class InspectedEnum extends Inspected {
  name: string;
  schema: string;
  elements: string[];
  pgVersion: number | null;
  dependents: string[];
  dependentOn: string[];

  constructor(name: string, schema: string, elements: string[], pgVersion?: number | null) {
    super();
    this.name = name;
    this.schema = schema;
    this.elements = elements;
    this.pgVersion = pgVersion ?? null;
    this.dependents = [];
    this.dependentOn = [];
  }

  get dropStatement(): string {
    return `drop type ${this.quotedFullName};`;
  }

  get createStatement(): string {
    const quoted = this.elements.map(e => `'${e}'`).join(', ');
    return `create type ${this.quotedFullName} as enum (${quoted});`;
  }
}

// ── Schema ──

export class InspectedSchema extends Inspected {
  schema: string;
  name: string;

  constructor(schema: string) {
    super();
    this.schema = schema;
    this.name = '';
  }

  get quotedFullName(): string {
    return this.quotedSchema;
  }

  get createStatement(): string {
    return `create schema if not exists ${this.quotedSchema};`;
  }

  get dropStatement(): string {
    return `drop schema if exists ${this.quotedSchema};`;
  }
}

// ── Type ──

export class InspectedType extends Inspected {
  name: string;
  schema: string;
  columns: Map<string, string>;

  constructor(name: string, schema: string, columns: Map<string, string>) {
    super();
    this.name = name;
    this.schema = schema;
    this.columns = columns;
  }

  get dropStatement(): string {
    return `drop type ${this.signature};`;
  }

  get createStatement(): string {
    let sql = `create type ${this.signature} as (\n`;
    const specs = [...this.columns.entries()].map(
      ([name, type]) => `    ${quotedIdentifier(name)} ${type}`
    );
    sql += specs.join(',\n');
    sql += '\n);';
    return sql;
  }
}

// ── Domain ──

export class InspectedDomain extends Inspected {
  name: string;
  schema: string;
  dataType: string;
  collation: string | null;
  constraintName: string | null;
  notNull: boolean;
  default: string | null;
  check: string | null;

  constructor(
    name: string, schema: string, dataType: string, collation: string | null,
    constraintName: string | null, notNull: boolean, defaultVal: string | null, check: string | null
  ) {
    super();
    this.name = name;
    this.schema = schema;
    this.dataType = dataType;
    this.collation = collation;
    this.constraintName = constraintName;
    this.notNull = notNull;
    this.default = defaultVal;
    this.check = check;
  }

  get dropStatement(): string {
    return `drop domain ${this.signature};`;
  }

  get createStatement(): string {
    let sql = `create domain ${this.signature}\nas ${this.dataType}\n`;
    if (this.collation) sql += `collation ${this.collation}\n`;
    if (this.default) sql += `default ${this.default}\n`;
    sql += this.notNull ? 'not null\n' : 'null\n';
    if (this.check) sql += `${this.check}\n`;
    return sql;
  }
}

// ── Extension ──

export class InspectedExtension extends Inspected {
  name: string;
  schema: string;
  version: string | null;

  constructor(name: string, schema: string, version?: string | null) {
    super();
    this.name = name;
    this.schema = schema;
    this.version = version ?? null;
  }

  get dropStatement(): string {
    return `drop extension if exists ${this.quotedName};`;
  }

  get createStatement(): string {
    const v = this.version ? ` version '${this.version}'` : '';
    return `create extension if not exists ${this.quotedName} with schema ${this.quotedSchema}${v};`;
  }
}

// ── Constraint ──

export class InspectedConstraint extends Inspected {
  name: string;
  schema: string;
  constraintType: string;
  tableName: string;
  definition: string;
  index: InspectedIndex | string | null;
  isFk: boolean;
  isDeferrable: boolean;
  initiallyDeferred: boolean;
  quotedFullForeignTableName: string | null;
  fkColumnsLocal: string[] | null;
  fkColumnsForeign: string[] | null;

  constructor(opts: {
    name: string;
    schema: string;
    constraintType: string;
    tableName: string;
    definition: string;
    index: string | null;
    isFk?: boolean;
    isDeferrable?: boolean;
    initiallyDeferred?: boolean;
  }) {
    super();
    this.name = opts.name;
    this.schema = opts.schema;
    this.constraintType = opts.constraintType;
    this.tableName = opts.tableName;
    this.definition = opts.definition;
    this.index = opts.index;
    this.isFk = opts.isFk ?? false;
    this.isDeferrable = opts.isDeferrable ?? false;
    this.initiallyDeferred = opts.initiallyDeferred ?? false;
    this.quotedFullForeignTableName = null;
    this.fkColumnsLocal = null;
    this.fkColumnsForeign = null;
  }

  get quotedFullName(): string {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}.${quotedIdentifier(this.name)}`;
  }

  get quotedFullTableName(): string {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}`;
  }

  get dropStatement(): string {
    return `alter table ${this.quotedFullTableName} drop constraint ${this.quotedName};`;
  }

  get createStatement(): string {
    let usingClause: string;
    if (this.index && this.constraintType !== 'EXCLUDE') {
      const indexName = typeof this.index === 'string' ? this.index : this.index.quotedName;
      let deferrable = '';
      if (this.isDeferrable) {
        deferrable = ' DEFERRABLE';
        if (this.initiallyDeferred) deferrable += ' INITIALLY DEFERRED';
      }
      usingClause = `${this.constraintType} using index ${indexName}${deferrable}`;
    } else {
      usingClause = this.definition;
    }
    return `alter table ${this.quotedFullTableName} add constraint ${this.quotedName} ${usingClause};`;
  }
}

// ── Privilege ──

export class InspectedPrivilege extends Inspected {
  objectType: string;
  schema: string;
  name: string;
  privilege: string;
  targetUser: string;

  constructor(objectType: string, schema: string, name: string, privilege: string, targetUser: string) {
    super();
    this.objectType = objectType;
    this.schema = schema;
    this.name = name;
    this.privilege = privilege.toLowerCase();
    this.targetUser = targetUser;
  }

  get key(): string {
    return `${this.objectType}:${this.quotedFullName}:${this.targetUser}:${this.privilege}`;
  }

  get dropStatement(): string {
    return `revoke ${this.privilege} on ${this.objectType} ${this.quotedFullName} from ${quotedIdentifier(this.targetUser)};`;
  }

  get createStatement(): string {
    return `grant ${this.privilege} on ${this.objectType} ${this.quotedFullName} to ${quotedIdentifier(this.targetUser)};`;
  }
}

// ── RLS Policy ──

const COMMANDTYPES: Record<string, string> = { '*': 'all', r: 'select', a: 'insert', w: 'update', d: 'delete' };

export class InspectedRowPolicy extends Inspected {
  name: string;
  schema: string;
  tableName: string;
  commandtype: string;
  permissive: boolean;
  roles: string[];
  qual: string | null;
  withcheck: string | null;

  constructor(
    name: string, schema: string, tableName: string,
    commandtype: string, permissive: boolean, roles: string[],
    qual: string | null, withcheck: string | null
  ) {
    super();
    this.name = name;
    this.schema = schema;
    this.tableName = tableName;
    this.commandtype = commandtype;
    this.permissive = permissive;
    this.roles = roles;
    this.qual = qual;
    this.withcheck = withcheck;
  }

  get quotedFullTableName(): string {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}`;
  }

  get key(): string {
    return `${this.quotedFullTableName}.${this.quotedName}`;
  }

  get permissiveness(): string {
    return this.permissive ? 'permissive' : 'restrictive';
  }

  get commandtypeKeyword(): string {
    return COMMANDTYPES[this.commandtype] ?? 'all';
  }

  get dropStatement(): string {
    return `drop policy ${this.quotedName} on ${this.quotedFullTableName};`;
  }

  get createStatement(): string {
    const qualClause = this.qual ? `\nusing (${this.qual})` : '';
    const withcheckClause = this.withcheck ? `\nwith check (${this.withcheck})` : '';
    const roleslist = this.roles.join(', ');
    return `create policy ${this.quotedName}\non ${this.quotedFullTableName}\nas ${this.permissiveness}\nfor ${this.commandtypeKeyword}\nto ${roleslist}${qualClause}${withcheckClause};\n`;
  }
}

// ── Inspection Result ──

export interface InspectionResult {
  schemas: Map<string, InspectedSchema>;
  tables: Map<string, InspectedSelectable>;
  views: Map<string, InspectedSelectable>;
  materializedViews: Map<string, InspectedSelectable>;
  compositeTypes: Map<string, InspectedSelectable>;
  relations: Map<string, InspectedSelectable>;
  selectables: Map<string, InspectedSelectable | InspectedFunction>;
  indexes: Map<string, InspectedIndex>;
  sequences: Map<string, InspectedSequence>;
  constraints: Map<string, InspectedConstraint>;
  enums: Map<string, InspectedEnum>;
  functions: Map<string, InspectedFunction>;
  triggers: Map<string, InspectedTrigger>;
  extensions: Map<string, InspectedExtension>;
  privileges: Map<string, InspectedPrivilege>;
  types: Map<string, InspectedType>;
  domains: Map<string, InspectedDomain>;
  collations: Map<string, InspectedCollation>;
  rlsPolicies: Map<string, InspectedRowPolicy>;
}
