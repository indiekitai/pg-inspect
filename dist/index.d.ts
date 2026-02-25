import pg from 'pg';

declare class ColumnInfo {
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
    });
    get quotedName(): string;
    get creationClause(): string;
    get collationSubclause(): string;
    equals(other: ColumnInfo): boolean;
}
declare abstract class Inspected {
    name: string;
    schema: string;
    get quotedFullName(): string;
    get signature(): string;
    get unquotedFullName(): string;
    get quotedName(): string;
    get quotedSchema(): string;
}
declare class InspectedSelectable extends Inspected {
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
    });
    get persistenceModifier(): string;
    get isUnlogged(): boolean;
    get isPartitioned(): boolean;
    get isTable(): boolean;
    get isInheritanceChildTable(): boolean;
    get isPartitioningChildTable(): boolean;
    get isAlterable(): boolean;
    get containsData(): boolean;
    get usesPartitioning(): boolean;
    hasCompatibleColumns(other: InspectedSelectable): boolean;
    canReplace(other: InspectedSelectable): boolean;
    get createStatement(): string;
    get dropStatement(): string;
    alterTableStatement(clause: string): string;
    get alterRlsStatement(): string;
    get alterUnloggedStatement(): string;
    equals(other: InspectedSelectable): boolean;
}
declare class InspectedFunction extends InspectedSelectable {
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
    });
    get signature(): string;
    get createStatement(): string;
    get thing(): string;
    get dropStatement(): string;
    equals(other: InspectedFunction): boolean;
}
declare class InspectedTrigger extends Inspected {
    name: string;
    schema: string;
    tableName: string;
    procSchema: string;
    procName: string;
    enabled: string;
    fullDefinition: string;
    dependentOn: string[];
    dependents: string[];
    constructor(name: string, schema: string, tableName: string, procSchema: string, procName: string, enabled: string, fullDefinition: string);
    get signature(): string;
    get quotedFullName(): string;
    get quotedFullSelectableName(): string;
    get dropStatement(): string;
    get createStatement(): string;
}
declare class InspectedIndex extends Inspected {
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
    });
    get quotedFullTableName(): string;
    get dropStatement(): string;
    get createStatement(): string;
    get isExclusionConstraint(): boolean;
}
declare class InspectedSequence extends Inspected {
    name: string;
    schema: string;
    tableName: string | null;
    columnName: string | null;
    constructor(name: string, schema: string, tableName?: string | null, columnName?: string | null);
    get quotedFullTableName(): string | null;
    get quotedTableAndColumnName(): string | null;
    get dropStatement(): string;
    get createStatement(): string;
}
declare class InspectedCollation extends Inspected {
    name: string;
    schema: string;
    provider: string;
    encoding: string;
    lcCollate: string;
    lcCtype: string;
    version: string | null;
    constructor(name: string, schema: string, provider: string, encoding: string, lcCollate: string, lcCtype: string, version: string | null);
    get locale(): string;
    get dropStatement(): string;
    get createStatement(): string;
}
declare class InspectedEnum extends Inspected {
    name: string;
    schema: string;
    elements: string[];
    pgVersion: number | null;
    dependents: string[];
    dependentOn: string[];
    constructor(name: string, schema: string, elements: string[], pgVersion?: number | null);
    get dropStatement(): string;
    get createStatement(): string;
}
declare class InspectedSchema extends Inspected {
    schema: string;
    name: string;
    constructor(schema: string);
    get quotedFullName(): string;
    get createStatement(): string;
    get dropStatement(): string;
}
declare class InspectedType extends Inspected {
    name: string;
    schema: string;
    columns: Map<string, string>;
    constructor(name: string, schema: string, columns: Map<string, string>);
    get dropStatement(): string;
    get createStatement(): string;
}
declare class InspectedDomain extends Inspected {
    name: string;
    schema: string;
    dataType: string;
    collation: string | null;
    constraintName: string | null;
    notNull: boolean;
    default: string | null;
    check: string | null;
    constructor(name: string, schema: string, dataType: string, collation: string | null, constraintName: string | null, notNull: boolean, defaultVal: string | null, check: string | null);
    get dropStatement(): string;
    get createStatement(): string;
}
declare class InspectedExtension extends Inspected {
    name: string;
    schema: string;
    version: string | null;
    constructor(name: string, schema: string, version?: string | null);
    get dropStatement(): string;
    get createStatement(): string;
}
declare class InspectedConstraint extends Inspected {
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
    });
    get quotedFullName(): string;
    get quotedFullTableName(): string;
    get dropStatement(): string;
    get createStatement(): string;
}
declare class InspectedPrivilege extends Inspected {
    objectType: string;
    schema: string;
    name: string;
    privilege: string;
    targetUser: string;
    constructor(objectType: string, schema: string, name: string, privilege: string, targetUser: string);
    get key(): string;
    get dropStatement(): string;
    get createStatement(): string;
}
declare class InspectedRowPolicy extends Inspected {
    name: string;
    schema: string;
    tableName: string;
    commandtype: string;
    permissive: boolean;
    roles: string[];
    qual: string | null;
    withcheck: string | null;
    constructor(name: string, schema: string, tableName: string, commandtype: string, permissive: boolean, roles: string[], qual: string | null, withcheck: string | null);
    get quotedFullTableName(): string;
    get key(): string;
    get permissiveness(): string;
    get commandtypeKeyword(): string;
    get dropStatement(): string;
    get createStatement(): string;
}
interface InspectionResult {
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

type ConnectionConfig = string | pg.PoolConfig;
declare class PgInspector {
    private client;
    private ownsConnection;
    private includeInternal;
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
    private pgVersion;
    constructor(clientOrConfig: pg.Pool | pg.Client | ConnectionConfig, opts?: {
        includeInternal?: boolean;
    });
    private execute;
    private q;
    inspect(): Promise<InspectionResult>;
    close(): Promise<void>;
    private loadSchemas;
    private loadAllRelations;
    private loadFunctions;
    private loadTriggers;
    private loadPrivileges;
    private loadCollations;
    private loadRlsPolicies;
    private loadTypes;
    private loadDomains;
    private loadDeps;
}
declare function inspect(config: ConnectionConfig, opts?: {
    includeInternal?: boolean;
}): Promise<InspectionResult>;

export { ColumnInfo, type ConnectionConfig, InspectedCollation, InspectedConstraint, InspectedDomain, InspectedEnum, InspectedExtension, InspectedFunction, InspectedIndex, InspectedPrivilege, InspectedRowPolicy, InspectedSchema, InspectedSelectable, InspectedSequence, InspectedTrigger, InspectedType, type InspectionResult, PgInspector, inspect };
