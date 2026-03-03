[English](README.md) | [中文](README.zh-CN.md)

# @indiekit/pg-inspect

[![npm version](https://img.shields.io/npm/v/@indiekit/pg-inspect.svg)](https://www.npmjs.com/package/@indiekit/pg-inspect)
[![license](https://img.shields.io/npm/l/@indiekit/pg-inspect.svg)](https://github.com/indiekitai/pg-inspect/blob/main/LICENSE)

**TypeScript/Node.js 的 PostgreSQL Schema 检查工具** —— Python [schemainspect](https://github.com/djrobstep/schemainspect) 的完整 TypeScript 移植。

将你的整个 PostgreSQL Schema 内省为结构化的类型对象。专为 Schema Diff、代码生成、迁移工具和 AI Agent 打造。

## 功能

- **完整的 Schema 检查** —— 表、视图、物化视图、索引、约束、函数、触发器、序列、枚举、扩展、域、排序规则、RLS 策略、权限和复合类型
- **完整的 TypeScript 类型** —— 每个对象都有强类型，导出类和接口
- **DDL 生成** —— 每个检查对象上都有 `createStatement` 和 `dropStatement`
- **依赖追踪** —— 知道哪些视图依赖于哪些表
- **MCP Server** —— 通过 Model Context Protocol 向 AI Agent 暴露 Schema 检查能力
- **CLI 支持 JSON 输出** —— 可管道到 `jq`，供脚本使用，集成到 CI/CD
- **零依赖**，仅依赖 `pg` (node-postgres)
- 支持 **PostgreSQL 9–17**

## 安装

```bash
npm install @indiekit/pg-inspect
```

## API 用法

### 完整检查

```typescript
import { inspect } from '@indiekit/pg-inspect';

const schema = await inspect('postgresql://user:pass@localhost/mydb');

// 所有结果都是以引号全名为 key 的 Map
schema.tables;           // Map<string, InspectedSelectable>
schema.views;            // Map<string, InspectedSelectable>
schema.indexes;          // Map<string, InspectedIndex>
schema.functions;        // Map<string, InspectedFunction>
schema.constraints;      // Map<string, InspectedConstraint>
schema.enums;            // Map<string, InspectedEnum>
schema.sequences;        // Map<string, InspectedSequence>
schema.triggers;         // Map<string, InspectedTrigger>
schema.extensions;       // Map<string, InspectedExtension>
schema.privileges;       // Map<string, InspectedPrivilege>
schema.types;            // Map<string, InspectedType>
schema.domains;          // Map<string, InspectedDomain>
schema.collations;       // Map<string, InspectedCollation>
schema.rlsPolicies;      // Map<string, InspectedRowPolicy>
```

### 使用结果

```typescript
// 遍历表
for (const [name, table] of schema.tables) {
  console.log(name, table.columns.size, 'columns');

  // 列详情
  for (const [colName, col] of table.columns) {
    console.log(`  ${colName}: ${col.dbtype} ${col.notNull ? 'NOT NULL' : ''}`);
  }

  // 生成 DDL
  console.log(table.createStatement);
  console.log(table.dropStatement);
}

// 检查依赖关系
for (const [name, view] of schema.views) {
  console.log(`${name} depends on:`, view.dependentOn);
}
```

### 连接选项

```typescript
import { inspect, PgInspector } from '@indiekit/pg-inspect';

// 连接字符串
const schema = await inspect('postgresql://user:pass@localhost:5432/mydb');

// 配置对象
const schema = await inspect({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'secret',
  database: 'mydb',
});

// 使用已有的 pg.Pool 或 pg.Client
import pg from 'pg';
const pool = new pg.Pool({ connectionString: '...' });
const inspector = new PgInspector(pool);
const schema = await inspector.inspect();
await inspector.close();

// 包含内部/系统 Schema
const schema = await inspect('postgresql://localhost/mydb', {
  includeInternal: true,
});
```

## CLI

```bash
# 完整检查（JSON 输出）
pg-inspect postgresql://localhost/mydb

# 按对象类型过滤
pg-inspect postgresql://localhost/mydb --tables
pg-inspect postgresql://localhost/mydb --tables --indexes --constraints

# 摘要计数
pg-inspect postgresql://localhost/mydb --summary

# 使用 DATABASE_URL
export DATABASE_URL=postgresql://localhost/mydb
pg-inspect --tables

# 管道到 jq
pg-inspect postgresql://localhost/mydb --enums | jq 'to_entries[] | .value.elements'

# 版本
pg-inspect --version
```

### 退出码

| 代码 | 含义 |
|------|------|
| 0 | 成功 |
| 1 | 连接或运行时错误 |
| 2 | 用法错误（缺少参数） |

## MCP Server

pg-inspect 内置 [Model Context Protocol](https://modelcontextprotocol.io) 服务器，支持 AI Agent 集成。

### 配置

添加到你的 MCP 客户端配置（Claude Desktop、Cursor 等）：

```json
{
  "mcpServers": {
    "pg-inspect": {
      "command": "npx",
      "args": ["@indiekit/pg-inspect", "--mcp"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@localhost/mydb"
      }
    }
  }
}
```

或直接运行：

```bash
DATABASE_URL=postgresql://localhost/mydb pg-inspect --mcp
```

### 可用工具

| 工具 | 描述 |
|------|------|
| `inspect` | 所有 Schema 对象的摘要计数 |
| `tables` | 所有表及其列、类型、默认值 |
| `indexes` | 所有索引及其定义和属性 |
| `functions` | 所有函数/过程及其签名 |
| `constraints` | 所有约束（PK、FK、唯一、检查、排除） |
| `enums` | 所有枚举类型及其值 |
| `views` | 所有视图和物化视图 |
| `sequences` | 所有序列 |
| `triggers` | 所有触发器及其定义 |

每个工具都接受可选的 `connectionString` 参数（默认使用 `DATABASE_URL`）。

## 与 Python schemainspect 的对比

| | **@indiekit/pg-inspect** | **schemainspect** (Python) |
|---|---|---|
| 语言 | TypeScript/Node.js | Python |
| 类型 | 完整 TypeScript 类型 | 无类型提示 |
| CLI | 内置，支持 JSON 输出 | 无 |
| MCP Server | 内置 | 无 |
| DDL 生成 | ✅ create/drop 语句 | ✅ create/drop 语句 |
| 依赖 | 仅 `pg` | `sqlalchemy`、`psycopg2` |
| Schema 覆盖范围 | 表、视图、物化视图、索引、约束、函数、触发器、序列、枚举、扩展、域、排序规则、RLS、权限、复合类型 | 相同 |
| PG 版本 | 9–17 | 9–15 |

这是一个忠实的移植 —— 相同的 SQL 查询、相同的对象模型、相同的覆盖范围 —— 但原生于 Node.js 生态，提供 TypeScript 类型、CLI 和 MCP 支持。

## 许可证

MIT
