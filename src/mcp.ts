#!/usr/bin/env node

/**
 * MCP (Model Context Protocol) server for pg-inspect.
 *
 * Exposes PostgreSQL schema inspection as MCP tools for use with
 * AI agents and LLM-powered development environments.
 *
 * @example
 * ```json
 * {
 *   "mcpServers": {
 *     "pg-inspect": {
 *       "command": "npx",
 *       "args": ["@indiekit/pg-inspect", "--mcp"],
 *       "env": { "DATABASE_URL": "postgresql://localhost/mydb" }
 *     }
 *   }
 * }
 * ```
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { inspect, type ConnectionConfig } from './inspector.js';
import type { InspectionResult } from './types.js';

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

function getConnectionString(): string {
  const url = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
  if (!url) {
    throw new Error(
      'No database connection configured. Set DATABASE_URL or PG_CONNECTION_STRING environment variable.'
    );
  }
  return url;
}

async function getResult(connectionString?: string): Promise<InspectionResult> {
  const conn = connectionString || getConnectionString();
  return inspect(conn);
}

function jsonText(data: any): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

const connParam = {
  connectionString: z.string().optional().describe('PostgreSQL connection string (defaults to DATABASE_URL env var)'),
};

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'pg-inspect',
    version: '0.1.0',
  });

  server.tool(
    'inspect',
    'Full PostgreSQL schema inspection — returns all tables, views, indexes, functions, constraints, enums, sequences, triggers, extensions, and more',
    connParam,
    async ({ connectionString }) => {
      const result = await getResult(connectionString);
      const summary: Record<string, number> = {};
      for (const [key, val] of Object.entries(result)) {
        if (val instanceof Map) summary[key] = val.size;
      }
      return jsonText(summary);
    }
  );

  server.tool(
    'tables',
    'List all tables with their columns, types, defaults, and constraints',
    connParam,
    async ({ connectionString }) => {
      const result = await getResult(connectionString);
      return jsonText(mapToObj(result.tables));
    }
  );

  server.tool(
    'indexes',
    'List all indexes with their definitions, columns, and properties',
    connParam,
    async ({ connectionString }) => {
      const result = await getResult(connectionString);
      return jsonText(mapToObj(result.indexes));
    }
  );

  server.tool(
    'functions',
    'List all functions and procedures with their signatures, language, and definitions',
    connParam,
    async ({ connectionString }) => {
      const result = await getResult(connectionString);
      return jsonText(mapToObj(result.functions));
    }
  );

  server.tool(
    'constraints',
    'List all constraints (primary keys, foreign keys, unique, check, exclusion)',
    connParam,
    async ({ connectionString }) => {
      const result = await getResult(connectionString);
      return jsonText(mapToObj(result.constraints));
    }
  );

  server.tool(
    'enums',
    'List all enum types with their values',
    connParam,
    async ({ connectionString }) => {
      const result = await getResult(connectionString);
      return jsonText(mapToObj(result.enums));
    }
  );

  server.tool(
    'views',
    'List all views and materialized views with their definitions',
    connParam,
    async ({ connectionString }) => {
      const result = await getResult(connectionString);
      return jsonText({
        views: mapToObj(result.views),
        materializedViews: mapToObj(result.materializedViews),
      });
    }
  );

  server.tool(
    'sequences',
    'List all sequences',
    connParam,
    async ({ connectionString }) => {
      const result = await getResult(connectionString);
      return jsonText(mapToObj(result.sequences));
    }
  );

  server.tool(
    'triggers',
    'List all triggers with their definitions',
    connParam,
    async ({ connectionString }) => {
      const result = await getResult(connectionString);
      return jsonText(mapToObj(result.triggers));
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run if executed directly
const isDirectRun = process.argv[1]?.includes('mcp');
if (isDirectRun) {
  startMcpServer().catch((err) => {
    console.error('MCP server error:', err.message);
    process.exit(1);
  });
}
