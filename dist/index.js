// src/inspector.ts
import pg from "pg";

// src/utils.ts
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
function quotedIdentifier(identifier, schema, identityArguments) {
  if (identifier === null && schema != null) {
    return `"${schema.replace(/"/g, '""')}"`;
  }
  let s = `"${(identifier ?? "").replace(/"/g, '""')}"`;
  if (schema) {
    s = `"${schema.replace(/"/g, '""')}".${s}`;
  }
  if (identityArguments != null) {
    s = `${s}(${identityArguments})`;
  }
  return s;
}
var _sqlDir;
function getSqlDir() {
  if (!_sqlDir) {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname2 = dirname(__filename);
      _sqlDir = join(__dirname2, "..", "src", "sql");
      try {
        readFileSync(join(_sqlDir, "schemas.sql"));
      } catch {
        _sqlDir = join(__dirname2, "sql");
      }
    } catch {
      _sqlDir = join(__dirname, "sql");
    }
  }
  return _sqlDir;
}
function resourceText(subpath) {
  const sqlDir = getSqlDir();
  const filename = subpath.replace("sql/", "");
  return readFileSync(join(sqlDir, filename), "utf-8");
}

// src/types.ts
var ColumnInfo = class {
  name;
  dbtype;
  dbtypestr;
  pytype;
  default;
  notNull;
  isEnum;
  enum;
  collation;
  isIdentity;
  isIdentityAlways;
  isGenerated;
  isInherited;
  canDropGenerated;
  constructor(opts) {
    this.name = opts.name || "";
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
  get quotedName() {
    return quotedIdentifier(this.name);
  }
  get creationClause() {
    let x = `${this.quotedName} ${this.dbtypestr}`;
    if (this.isIdentity) {
      const identityType = this.isIdentityAlways ? "always" : "by default";
      x += ` generated ${identityType} as identity`;
    }
    if (this.notNull) {
      x += " not null";
    }
    if (this.isGenerated) {
      x += ` generated always as (${this.default}) stored`;
    } else if (this.default) {
      x += ` default ${this.default}`;
    }
    return x;
  }
  get collationSubclause() {
    if (this.collation) {
      return ` collate ${quotedIdentifier(this.collation)}`;
    }
    return "";
  }
  equals(other) {
    return this.name === other.name && this.dbtype === other.dbtype && this.dbtypestr === other.dbtypestr && this.default === other.default && this.notNull === other.notNull && this.enum === other.enum && this.collation === other.collation && this.isIdentity === other.isIdentity && this.isIdentityAlways === other.isIdentityAlways && this.isGenerated === other.isGenerated && this.isInherited === other.isInherited;
  }
};
var Inspected = class {
  name;
  schema;
  get quotedFullName() {
    return quotedIdentifier(this.name, this.schema);
  }
  get signature() {
    return this.quotedFullName;
  }
  get unquotedFullName() {
    return `${this.schema}.${this.name}`;
  }
  get quotedName() {
    return quotedIdentifier(this.name);
  }
  get quotedSchema() {
    return quotedIdentifier(this.schema);
  }
};
var InspectedSelectable = class extends Inspected {
  name;
  schema;
  columns;
  inputs;
  definition;
  relationtype;
  dependentOn;
  dependents;
  dependentOnAll;
  dependentsAll;
  constraints;
  indexes;
  comment;
  parentTable;
  partitionDef;
  rowsecurity;
  forcerowsecurity;
  persistence;
  constructor(opts) {
    super();
    this.name = opts.name;
    this.schema = opts.schema;
    this.columns = opts.columns;
    this.inputs = opts.inputs ?? [];
    this.definition = opts.definition ?? null;
    this.relationtype = opts.relationtype ?? "unknown";
    this.dependentOn = opts.dependentOn ?? [];
    this.dependents = opts.dependents ?? [];
    this.dependentOnAll = [];
    this.dependentsAll = [];
    this.constraints = /* @__PURE__ */ new Map();
    this.indexes = /* @__PURE__ */ new Map();
    this.comment = opts.comment ?? null;
    this.parentTable = opts.parentTable ?? null;
    this.partitionDef = opts.partitionDef ?? null;
    this.rowsecurity = opts.rowsecurity ?? false;
    this.forcerowsecurity = opts.forcerowsecurity ?? false;
    this.persistence = opts.persistence ?? null;
  }
  get persistenceModifier() {
    if (this.persistence === "t") return "temporary ";
    if (this.persistence === "u") return "unlogged ";
    return "";
  }
  get isUnlogged() {
    return this.persistence === "u";
  }
  get isPartitioned() {
    return this.relationtype === "p";
  }
  get isTable() {
    return this.relationtype === "r" || this.relationtype === "p";
  }
  get isInheritanceChildTable() {
    return !!this.parentTable && !this.partitionDef;
  }
  get isPartitioningChildTable() {
    return this.relationtype === "r" && !!this.parentTable && !!this.partitionDef;
  }
  get isAlterable() {
    return this.isTable && (!this.parentTable || this.isInheritanceChildTable);
  }
  get containsData() {
    return this.relationtype === "r" && (!!this.parentTable || !this.partitionDef);
  }
  get usesPartitioning() {
    return this.isPartitioningChildTable || this.isPartitioned;
  }
  hasCompatibleColumns(other) {
    const namesAndTypes = (cols) => [...cols.entries()].map(([k, c]) => `${k}:${c.dbtype}`);
    let items = namesAndTypes(this.columns);
    if (this.relationtype !== "f") {
      items = items.slice(0, other.columns.size);
    }
    return JSON.stringify(items) === JSON.stringify(namesAndTypes(other.columns));
  }
  canReplace(other) {
    if (!(this.relationtype === "v" || this.relationtype === "f" || this.isTable)) return false;
    if (this.signature !== other.signature) return false;
    if (this.relationtype !== other.relationtype) return false;
    return this.hasCompatibleColumns(other);
  }
  get createStatement() {
    const n = this.quotedFullName;
    if (this.relationtype === "r" || this.relationtype === "p") {
      if (!this.isPartitioningChildTable) {
        let colspec = [...this.columns.values()].map((c) => "    " + c.creationClause).join(",\n");
        if (colspec) colspec = "\n" + colspec;
        let partitionKey = "";
        let inheritsClause = "";
        if (this.partitionDef) {
          partitionKey = " partition by " + this.partitionDef;
        } else if (this.parentTable) {
          inheritsClause = ` inherits (${this.parentTable})`;
        }
        return `create ${this.persistenceModifier}table ${n} (${colspec}
)${partitionKey}${inheritsClause};
`;
      } else {
        return `create ${this.persistenceModifier}table ${n} partition of ${this.parentTable} ${this.partitionDef};
`;
      }
    } else if (this.relationtype === "v") {
      return `create or replace view ${n} as ${this.definition}
`;
    } else if (this.relationtype === "m") {
      return `create materialized view ${n} as ${this.definition}
`;
    } else if (this.relationtype === "c") {
      const colspec = [...this.columns.values()].map((c) => c.creationClause).join(", ");
      return `create type ${n} as (${colspec});`;
    }
    throw new Error("Not implemented");
  }
  get dropStatement() {
    const n = this.quotedFullName;
    if (this.relationtype === "r" || this.relationtype === "p") return `drop table ${n};`;
    if (this.relationtype === "v") return `drop view if exists ${n};`;
    if (this.relationtype === "m") return `drop materialized view if exists ${n};`;
    if (this.relationtype === "c") return `drop type ${n};`;
    throw new Error("Not implemented");
  }
  alterTableStatement(clause) {
    if (this.isAlterable) {
      return `alter table ${this.quotedFullName} ${clause};`;
    }
    throw new Error("Not implemented");
  }
  get alterRlsStatement() {
    const keyword = this.rowsecurity ? "enable" : "disable";
    return this.alterTableStatement(`${keyword} row level security`);
  }
  get alterUnloggedStatement() {
    const keyword = this.isUnlogged ? "unlogged" : "logged";
    return this.alterTableStatement(`set ${keyword}`);
  }
  equals(other) {
    const colsEqual = () => {
      const a = [...this.columns.entries()];
      const b = [...other.columns.entries()];
      if (a.length !== b.length) return false;
      return a.every(([k, v], i) => k === b[i][0] && v.equals(b[i][1]));
    };
    return this.constructor === other.constructor && this.relationtype === other.relationtype && this.name === other.name && this.schema === other.schema && colsEqual() && JSON.stringify(this.inputs) === JSON.stringify(other.inputs) && this.definition === other.definition && this.parentTable === other.parentTable && this.partitionDef === other.partitionDef && this.rowsecurity === other.rowsecurity && this.persistence === other.persistence;
  }
};
var InspectedFunction = class extends InspectedSelectable {
  identityArguments;
  resultString;
  language;
  volatility;
  strictness;
  securityType;
  fullDefinition;
  returntype;
  kind;
  constructor(opts) {
    super({
      name: opts.name,
      schema: opts.schema,
      columns: opts.columns,
      inputs: opts.inputs,
      definition: opts.definition,
      relationtype: "f",
      comment: opts.comment
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
  get signature() {
    return `${this.quotedFullName}(${this.identityArguments})`;
  }
  get createStatement() {
    return this.fullDefinition + ";";
  }
  get thing() {
    const kinds = { f: "function", p: "procedure", a: "aggregate", w: "window function" };
    return kinds[this.kind] ?? "function";
  }
  get dropStatement() {
    return `drop ${this.thing} if exists ${this.signature};`;
  }
  equals(other) {
    return this.signature === other.signature && this.resultString === other.resultString && this.definition === other.definition && this.language === other.language && this.volatility === other.volatility && this.strictness === other.strictness && this.securityType === other.securityType && this.kind === other.kind;
  }
};
var InspectedTrigger = class extends Inspected {
  name;
  schema;
  tableName;
  procSchema;
  procName;
  enabled;
  fullDefinition;
  dependentOn;
  dependents;
  constructor(name, schema, tableName, procSchema, procName, enabled, fullDefinition) {
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
  get signature() {
    return this.quotedFullName;
  }
  get quotedFullName() {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}.${quotedIdentifier(this.name)}`;
  }
  get quotedFullSelectableName() {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}`;
  }
  get dropStatement() {
    return `drop trigger if exists "${this.name}" on "${this.schema}"."${this.tableName}";`;
  }
  get createStatement() {
    const statusSql = {
      O: "ENABLE TRIGGER",
      D: "DISABLE TRIGGER",
      R: "ENABLE REPLICA TRIGGER",
      A: "ENABLE ALWAYS TRIGGER"
    };
    if (["D", "R", "A"].includes(this.enabled)) {
      const s = quotedIdentifier(this.schema);
      const t = quotedIdentifier(this.tableName);
      const tn = quotedIdentifier(this.name);
      return `${this.fullDefinition};
ALTER TABLE ${s}.${t} ${statusSql[this.enabled]} ${tn};`;
    }
    return this.fullDefinition + ";";
  }
};
var InspectedIndex = class extends Inspected {
  name;
  schema;
  definition;
  tableName;
  keyColumns;
  keyOptions;
  numAtt;
  isUnique;
  isPk;
  isExclusion;
  isImmediate;
  isClustered;
  keyCollations;
  keyExpressions;
  partialPredicate;
  algorithm;
  constraint;
  indexColumns;
  includedColumns;
  constructor(opts) {
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
  get quotedFullTableName() {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}`;
  }
  get dropStatement() {
    const stmt = `drop index if exists ${this.quotedFullName};`;
    if (this.isExclusionConstraint) return "select 1; -- " + stmt;
    return stmt;
  }
  get createStatement() {
    const stmt = `${this.definition};`;
    if (this.isExclusionConstraint) return "select 1; -- " + stmt;
    return stmt;
  }
  get isExclusionConstraint() {
    return !!this.constraint && this.constraint.constraintType === "EXCLUDE";
  }
};
var InspectedSequence = class extends Inspected {
  name;
  schema;
  tableName;
  columnName;
  constructor(name, schema, tableName, columnName) {
    super();
    this.name = name;
    this.schema = schema;
    this.tableName = tableName ?? null;
    this.columnName = columnName ?? null;
  }
  get quotedFullTableName() {
    if (this.tableName != null) return quotedIdentifier(this.tableName, this.schema);
    return null;
  }
  get quotedTableAndColumnName() {
    if (this.columnName != null && this.tableName != null) {
      return this.quotedFullTableName + "." + quotedIdentifier(this.columnName);
    }
    return null;
  }
  get dropStatement() {
    return `drop sequence if exists ${this.quotedFullName};`;
  }
  get createStatement() {
    return `create sequence ${this.quotedFullName};`;
  }
};
var InspectedCollation = class extends Inspected {
  name;
  schema;
  provider;
  encoding;
  lcCollate;
  lcCtype;
  version;
  constructor(name, schema, provider, encoding, lcCollate, lcCtype, version) {
    super();
    this.name = name;
    this.schema = schema;
    this.provider = provider;
    this.encoding = encoding;
    this.lcCollate = lcCollate;
    this.lcCtype = lcCtype;
    this.version = version;
  }
  get locale() {
    return this.lcCollate;
  }
  get dropStatement() {
    return `drop collation if exists ${this.quotedFullName};`;
  }
  get createStatement() {
    return `create collation if not exists ${this.quotedFullName} (provider = '${this.provider}', locale = '${this.locale}');`;
  }
};
var InspectedEnum = class extends Inspected {
  name;
  schema;
  elements;
  pgVersion;
  dependents;
  dependentOn;
  constructor(name, schema, elements, pgVersion) {
    super();
    this.name = name;
    this.schema = schema;
    this.elements = elements;
    this.pgVersion = pgVersion ?? null;
    this.dependents = [];
    this.dependentOn = [];
  }
  get dropStatement() {
    return `drop type ${this.quotedFullName};`;
  }
  get createStatement() {
    const quoted = this.elements.map((e) => `'${e}'`).join(", ");
    return `create type ${this.quotedFullName} as enum (${quoted});`;
  }
};
var InspectedSchema = class extends Inspected {
  schema;
  name;
  constructor(schema) {
    super();
    this.schema = schema;
    this.name = "";
  }
  get quotedFullName() {
    return this.quotedSchema;
  }
  get createStatement() {
    return `create schema if not exists ${this.quotedSchema};`;
  }
  get dropStatement() {
    return `drop schema if exists ${this.quotedSchema};`;
  }
};
var InspectedType = class extends Inspected {
  name;
  schema;
  columns;
  constructor(name, schema, columns) {
    super();
    this.name = name;
    this.schema = schema;
    this.columns = columns;
  }
  get dropStatement() {
    return `drop type ${this.signature};`;
  }
  get createStatement() {
    let sql = `create type ${this.signature} as (
`;
    const specs = [...this.columns.entries()].map(
      ([name, type]) => `    ${quotedIdentifier(name)} ${type}`
    );
    sql += specs.join(",\n");
    sql += "\n);";
    return sql;
  }
};
var InspectedDomain = class extends Inspected {
  name;
  schema;
  dataType;
  collation;
  constraintName;
  notNull;
  default;
  check;
  constructor(name, schema, dataType, collation, constraintName, notNull, defaultVal, check) {
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
  get dropStatement() {
    return `drop domain ${this.signature};`;
  }
  get createStatement() {
    let sql = `create domain ${this.signature}
as ${this.dataType}
`;
    if (this.collation) sql += `collation ${this.collation}
`;
    if (this.default) sql += `default ${this.default}
`;
    sql += this.notNull ? "not null\n" : "null\n";
    if (this.check) sql += `${this.check}
`;
    return sql;
  }
};
var InspectedExtension = class extends Inspected {
  name;
  schema;
  version;
  constructor(name, schema, version) {
    super();
    this.name = name;
    this.schema = schema;
    this.version = version ?? null;
  }
  get dropStatement() {
    return `drop extension if exists ${this.quotedName};`;
  }
  get createStatement() {
    const v = this.version ? ` version '${this.version}'` : "";
    return `create extension if not exists ${this.quotedName} with schema ${this.quotedSchema}${v};`;
  }
};
var InspectedConstraint = class extends Inspected {
  name;
  schema;
  constraintType;
  tableName;
  definition;
  index;
  isFk;
  isDeferrable;
  initiallyDeferred;
  quotedFullForeignTableName;
  fkColumnsLocal;
  fkColumnsForeign;
  constructor(opts) {
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
  get quotedFullName() {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}.${quotedIdentifier(this.name)}`;
  }
  get quotedFullTableName() {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}`;
  }
  get dropStatement() {
    return `alter table ${this.quotedFullTableName} drop constraint ${this.quotedName};`;
  }
  get createStatement() {
    let usingClause;
    if (this.index && this.constraintType !== "EXCLUDE") {
      const indexName = typeof this.index === "string" ? this.index : this.index.quotedName;
      let deferrable = "";
      if (this.isDeferrable) {
        deferrable = " DEFERRABLE";
        if (this.initiallyDeferred) deferrable += " INITIALLY DEFERRED";
      }
      usingClause = `${this.constraintType} using index ${indexName}${deferrable}`;
    } else {
      usingClause = this.definition;
    }
    return `alter table ${this.quotedFullTableName} add constraint ${this.quotedName} ${usingClause};`;
  }
};
var InspectedPrivilege = class extends Inspected {
  objectType;
  schema;
  name;
  privilege;
  targetUser;
  constructor(objectType, schema, name, privilege, targetUser) {
    super();
    this.objectType = objectType;
    this.schema = schema;
    this.name = name;
    this.privilege = privilege.toLowerCase();
    this.targetUser = targetUser;
  }
  get key() {
    return `${this.objectType}:${this.quotedFullName}:${this.targetUser}:${this.privilege}`;
  }
  get dropStatement() {
    return `revoke ${this.privilege} on ${this.objectType} ${this.quotedFullName} from ${quotedIdentifier(this.targetUser)};`;
  }
  get createStatement() {
    return `grant ${this.privilege} on ${this.objectType} ${this.quotedFullName} to ${quotedIdentifier(this.targetUser)};`;
  }
};
var COMMANDTYPES = { "*": "all", r: "select", a: "insert", w: "update", d: "delete" };
var InspectedRowPolicy = class extends Inspected {
  name;
  schema;
  tableName;
  commandtype;
  permissive;
  roles;
  qual;
  withcheck;
  constructor(name, schema, tableName, commandtype, permissive, roles, qual, withcheck) {
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
  get quotedFullTableName() {
    return `${quotedIdentifier(this.schema)}.${quotedIdentifier(this.tableName)}`;
  }
  get key() {
    return `${this.quotedFullTableName}.${this.quotedName}`;
  }
  get permissiveness() {
    return this.permissive ? "permissive" : "restrictive";
  }
  get commandtypeKeyword() {
    return COMMANDTYPES[this.commandtype] ?? "all";
  }
  get dropStatement() {
    return `drop policy ${this.quotedName} on ${this.quotedFullTableName};`;
  }
  get createStatement() {
    const qualClause = this.qual ? `
using (${this.qual})` : "";
    const withcheckClause = this.withcheck ? `
with check (${this.withcheck})` : "";
    const roleslist = this.roles.join(", ");
    return `create policy ${this.quotedName}
on ${this.quotedFullTableName}
as ${this.permissiveness}
for ${this.commandtypeKeyword}
to ${roleslist}${qualClause}${withcheckClause};
`;
  }
};

// src/inspector.ts
var { Pool, Client } = pg;
var ALL_RELATIONS_QUERY = resourceText("sql/relations.sql");
var ALL_RELATIONS_QUERY_9 = resourceText("sql/relations9.sql");
var SCHEMAS_QUERY = resourceText("sql/schemas.sql");
var INDEXES_QUERY = resourceText("sql/indexes.sql");
var SEQUENCES_QUERY = resourceText("sql/sequences.sql");
var CONSTRAINTS_QUERY = resourceText("sql/constraints.sql");
var FUNCTIONS_QUERY = resourceText("sql/functions.sql");
var TYPES_QUERY = resourceText("sql/types.sql");
var DOMAINS_QUERY = resourceText("sql/domains.sql");
var EXTENSIONS_QUERY = resourceText("sql/extensions.sql");
var ENUMS_QUERY = resourceText("sql/enums.sql");
var DEPS_QUERY = resourceText("sql/deps.sql");
var PRIVILEGES_QUERY = resourceText("sql/privileges.sql");
var TRIGGERS_QUERY = resourceText("sql/triggers.sql");
var COLLATIONS_QUERY = resourceText("sql/collations.sql");
var COLLATIONS_QUERY_9 = resourceText("sql/collations9.sql");
var RLSPOLICIES_QUERY = resourceText("sql/rlspolicies.sql");
function processQuery(q, pgVersion, includeInternal) {
  if (!includeInternal) {
    q = q.replace(/-- SKIP_INTERNAL/g, "");
  }
  if (pgVersion >= 11) {
    q = q.replace(/-- 11_AND_LATER/g, "");
  } else {
    q = q.replace(/-- 10_AND_EARLIER/g, "");
  }
  q = q.replace(/\\:/g, ":");
  return q;
}
var PgInspector = class {
  client;
  ownsConnection;
  includeInternal;
  // Results
  schemas = /* @__PURE__ */ new Map();
  tables = /* @__PURE__ */ new Map();
  views = /* @__PURE__ */ new Map();
  materializedViews = /* @__PURE__ */ new Map();
  compositeTypes = /* @__PURE__ */ new Map();
  relations = /* @__PURE__ */ new Map();
  selectables = /* @__PURE__ */ new Map();
  indexes = /* @__PURE__ */ new Map();
  sequences = /* @__PURE__ */ new Map();
  constraints = /* @__PURE__ */ new Map();
  enums = /* @__PURE__ */ new Map();
  functions = /* @__PURE__ */ new Map();
  triggers = /* @__PURE__ */ new Map();
  extensions = /* @__PURE__ */ new Map();
  privileges = /* @__PURE__ */ new Map();
  types = /* @__PURE__ */ new Map();
  domains = /* @__PURE__ */ new Map();
  collations = /* @__PURE__ */ new Map();
  rlsPolicies = /* @__PURE__ */ new Map();
  pgVersion = 0;
  constructor(clientOrConfig, opts) {
    this.includeInternal = opts?.includeInternal ?? false;
    if (clientOrConfig instanceof Pool || clientOrConfig instanceof Client) {
      this.client = clientOrConfig;
      this.ownsConnection = false;
    } else if (typeof clientOrConfig === "string" || typeof clientOrConfig === "object" && clientOrConfig !== null) {
      this.client = new Pool(typeof clientOrConfig === "string" ? { connectionString: clientOrConfig } : clientOrConfig);
      this.ownsConnection = true;
    } else {
      throw new Error("Invalid connection config");
    }
  }
  async execute(query) {
    const result = await this.client.query(query);
    return result.rows;
  }
  q(query) {
    return processQuery(query, this.pgVersion, this.includeInternal);
  }
  async inspect() {
    const versionResult = await this.execute("SHOW server_version");
    const versionStr = versionResult[0].server_version;
    this.pgVersion = parseInt(versionStr.split(".")[0], 10);
    await this.loadSchemas();
    await this.loadAllRelations();
    await this.loadFunctions();
    this.selectables = /* @__PURE__ */ new Map();
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
      rlsPolicies: this.rlsPolicies
    };
  }
  async close() {
    if (this.ownsConnection && this.client instanceof Pool) {
      await this.client.end();
    }
  }
  async loadSchemas() {
    const rows = await this.execute(this.q(SCHEMAS_QUERY));
    this.schemas = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const s = new InspectedSchema(row.schema);
      this.schemas.set(s.schema, s);
    }
  }
  async loadAllRelations() {
    this.tables = /* @__PURE__ */ new Map();
    this.views = /* @__PURE__ */ new Map();
    this.materializedViews = /* @__PURE__ */ new Map();
    this.compositeTypes = /* @__PURE__ */ new Map();
    const enumRows = await this.execute(this.q(ENUMS_QUERY));
    this.enums = /* @__PURE__ */ new Map();
    for (const row of enumRows) {
      const e = new InspectedEnum(row.name, row.schema, row.elements, this.pgVersion);
      this.enums.set(e.quotedFullName, e);
    }
    let relQuery;
    if (this.pgVersion <= 9) {
      relQuery = this.q(ALL_RELATIONS_QUERY_9);
    } else {
      let q = ALL_RELATIONS_QUERY;
      if (this.pgVersion >= 12) {
        q = q.replace(/-- 12_ONLY/g, "");
      } else {
        q = q.replace(/-- PRE_12/g, "");
      }
      relQuery = this.q(q);
    }
    const relRows = await this.execute(relQuery);
    const groups = /* @__PURE__ */ new Map();
    for (const row of relRows) {
      const key = `${row.relationtype}|${row.schema}|${row.name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    for (const [, clist] of groups) {
      const f = clist[0];
      const getEnum = (name, schema) => {
        if (!name && !schema) return null;
        const qfn = `${quotedIdentifier(schema)}.${quotedIdentifier(name)}`;
        return this.enums.get(qfn) ?? null;
      };
      const columns = /* @__PURE__ */ new Map();
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
          canDropGenerated: this.pgVersion >= 13
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
        persistence: f.persistence
      });
      const RELATIONTYPES = {
        r: "tables",
        v: "views",
        m: "materializedViews",
        c: "compositeTypes",
        p: "tables"
      };
      const att = RELATIONTYPES[f.relationtype];
      if (att === "tables") this.tables.set(s.quotedFullName, s);
      else if (att === "views") this.views.set(s.quotedFullName, s);
      else if (att === "materializedViews") this.materializedViews.set(s.quotedFullName, s);
      else if (att === "compositeTypes") this.compositeTypes.set(s.quotedFullName, s);
    }
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
    this.relations = /* @__PURE__ */ new Map();
    for (const [k, v] of this.tables) this.relations.set(k, v);
    for (const [k, v] of this.views) this.relations.set(k, v);
    for (const [k, v] of this.materializedViews) this.relations.set(k, v);
    const idxRows = await this.execute(this.q(INDEXES_QUERY));
    this.indexes = /* @__PURE__ */ new Map();
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
        algorithm: i.algorithm
      });
      this.indexes.set(idx.quotedFullName, idx);
    }
    const seqRows = await this.execute(this.q(SEQUENCES_QUERY));
    this.sequences = /* @__PURE__ */ new Map();
    for (const i of seqRows) {
      const seq = new InspectedSequence(i.name, i.schema, i.table_name, i.column_name);
      this.sequences.set(seq.quotedFullName, seq);
    }
    const conRows = await this.execute(this.q(CONSTRAINTS_QUERY));
    this.constraints = /* @__PURE__ */ new Map();
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
        initiallyDeferred: i.initially_deferred
      });
      if (constraint.index && typeof constraint.index === "string") {
        const indexName = quotedIdentifier(constraint.index, i.schema);
        const index = this.indexes.get(indexName);
        if (index) {
          index.constraint = constraint;
          constraint.index = index;
        }
      }
      if (constraint.isFk) {
        constraint.quotedFullForeignTableName = quotedIdentifier(
          i.foreign_table_name,
          i.foreign_table_schema
        );
        constraint.fkColumnsForeign = i.fk_columns_foreign;
        constraint.fkColumnsLocal = i.fk_columns_local;
      }
      this.constraints.set(constraint.quotedFullName, constraint);
    }
    const extRows = await this.execute(this.q(EXTENSIONS_QUERY));
    this.extensions = /* @__PURE__ */ new Map();
    for (const i of extRows) {
      const ext = new InspectedExtension(i.name, i.schema, i.version);
      this.extensions.set(ext.name, ext);
    }
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
  async loadFunctions() {
    this.functions = /* @__PURE__ */ new Map();
    const rows = await this.execute(this.q(FUNCTIONS_QUERY));
    const groups = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = `${row.schema}|${row.name}|${row.identity_arguments}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    for (const [, clist] of groups) {
      const f = clist[0];
      const outs = clist.filter((c) => c.parameter_mode === "OUT");
      let columns;
      if (outs.length > 0) {
        columns = outs.map((c) => new ColumnInfo({
          name: c.parameter_name,
          dbtype: c.data_type,
          pytype: null
        }));
      } else {
        columns = [new ColumnInfo({
          name: f.name,
          dbtype: f.data_type,
          pytype: null,
          default: f.parameter_default
        })];
      }
      const plist = clist.filter((c) => c.parameter_mode === "IN").map((c) => new ColumnInfo({
        name: c.parameter_name,
        dbtype: c.data_type,
        pytype: null,
        default: c.parameter_default
      }));
      const fn = new InspectedFunction({
        schema: f.schema,
        name: f.name,
        columns: new Map(columns.map((c) => [c.name, c])),
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
        kind: f.kind
      });
      const identityArguments = `(${fn.identityArguments})`;
      this.functions.set(fn.quotedFullName + identityArguments, fn);
    }
  }
  async loadTriggers() {
    const rows = await this.execute(this.q(TRIGGERS_QUERY));
    this.triggers = /* @__PURE__ */ new Map();
    for (const i of rows) {
      const t = new InspectedTrigger(
        i.name,
        i.schema,
        i.table_name,
        i.proc_schema,
        i.proc_name,
        i.enabled,
        i.full_definition
      );
      this.triggers.set(t.signature, t);
    }
  }
  async loadPrivileges() {
    const rows = await this.execute(this.q(PRIVILEGES_QUERY));
    this.privileges = /* @__PURE__ */ new Map();
    for (const i of rows) {
      const p = new InspectedPrivilege(i.object_type, i.schema, i.name, i.privilege, i.user);
      this.privileges.set(p.key, p);
    }
  }
  async loadCollations() {
    const query = this.pgVersion <= 9 ? COLLATIONS_QUERY_9 : COLLATIONS_QUERY;
    const rows = await this.execute(this.q(query));
    this.collations = /* @__PURE__ */ new Map();
    for (const i of rows) {
      const c = new InspectedCollation(
        i.name,
        i.schema,
        i.provider,
        i.encoding,
        i.lc_collate,
        i.lc_ctype,
        i.version
      );
      this.collations.set(c.quotedFullName, c);
    }
  }
  async loadRlsPolicies() {
    if (this.pgVersion <= 9) {
      this.rlsPolicies = /* @__PURE__ */ new Map();
      return;
    }
    const rows = await this.execute(this.q(RLSPOLICIES_QUERY));
    this.rlsPolicies = /* @__PURE__ */ new Map();
    for (const p of rows) {
      const rp = new InspectedRowPolicy(
        p.name,
        p.schema,
        p.table_name,
        p.commandtype,
        p.permissive,
        p.roles,
        p.qual,
        p.withcheck
      );
      this.rlsPolicies.set(rp.key, rp);
    }
  }
  async loadTypes() {
    const rows = await this.execute(this.q(TYPES_QUERY));
    this.types = /* @__PURE__ */ new Map();
    for (const i of rows) {
      const cols = /* @__PURE__ */ new Map();
      if (Array.isArray(i.columns)) {
        for (const defn of i.columns) {
          cols.set(defn.attribute, defn.type);
        }
      }
      const t = new InspectedType(i.name, i.schema, cols);
      this.types.set(t.signature, t);
    }
  }
  async loadDomains() {
    const rows = await this.execute(this.q(DOMAINS_QUERY));
    this.domains = /* @__PURE__ */ new Map();
    for (const i of rows) {
      const d = new InspectedDomain(
        i.name,
        i.schema,
        i.data_type,
        i.collation,
        i.constraint_name,
        i.not_null,
        i.default,
        i.check
      );
      this.domains.set(d.signature, d);
    }
  }
  async loadDeps() {
    const rows = await this.execute(this.q(DEPS_QUERY));
    for (const dep of rows) {
      const x = quotedIdentifier(dep.name, dep.schema, dep.identity_arguments);
      const xDep = quotedIdentifier(
        dep.name_dependent_on,
        dep.schema_dependent_on,
        dep.identity_arguments_dependent_on
      );
      const selectable = this.selectables.get(x);
      if (selectable && "dependentOn" in selectable) {
        selectable.dependentOn.push(xDep);
        selectable.dependentOn.sort();
      }
      const depOn = this.selectables.get(xDep);
      if (depOn && "dependents" in depOn) {
        depOn.dependents.push(x);
        depOn.dependents.sort();
      }
    }
    for (const [k, t] of this.triggers) {
      for (const depName of t.dependentOn) {
        const dependency = this.selectables.get(depName);
        if (dependency && "dependents" in dependency) {
          dependency.dependents.push(k);
        }
      }
    }
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
};
async function inspect(config, opts) {
  const inspector = new PgInspector(config, opts);
  try {
    return await inspector.inspect();
  } finally {
    await inspector.close();
  }
}
export {
  ColumnInfo,
  InspectedCollation,
  InspectedConstraint,
  InspectedDomain,
  InspectedEnum,
  InspectedExtension,
  InspectedFunction,
  InspectedIndex,
  InspectedPrivilege,
  InspectedRowPolicy,
  InspectedSchema,
  InspectedSelectable,
  InspectedSequence,
  InspectedTrigger,
  InspectedType,
  PgInspector,
  inspect
};
//# sourceMappingURL=index.js.map