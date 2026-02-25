export { PgInspector, inspect } from './inspector.js';
export type { ConnectionConfig } from './inspector.js';
export { startMcpServer } from './mcp.js';
export {
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
