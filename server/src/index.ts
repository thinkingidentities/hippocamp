#!/usr/bin/env node

/**
 * Hippocamp MCP Server
 *
 * The hippocampus for AI agents - providing persistent episodic and semantic memory
 * through Neo4j graph database and Redis cache, accessible via Model Context Protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Neo4jMemoryStore } from './neo4j-store.js';
import { RedisCache } from './redis-cache.js';

// Configuration from environment or defaults
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7688';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'MPohzsk$oVguC@HG0I#vONGH%Rih%tC^';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

class HippocampServer {
  private server: Server;
  private neo4jStore: Neo4jMemoryStore;
  private redisCache: RedisCache;

  constructor() {
    this.server = new Server(
      {
        name: 'hippocamp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.neo4jStore = new Neo4jMemoryStore(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);
    this.redisCache = new RedisCache(REDIS_HOST, REDIS_PORT);

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_memory',
          description: 'Search across all memories using full-text and semantic search. Returns conversations and knowledge from the memory graph.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (keywords or natural language)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_by_category',
          description: 'Retrieve all memories in a specific category/folder. Use this to explore memories organized by topic.',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Category name (e.g., "EP2", "DGX Spark", "Memory & Knowledge")',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 20)',
                default: 20,
              },
            },
            required: ['category'],
          },
        },
        {
          name: 'get_conversation',
          description: 'Retrieve a specific conversation by ID. Returns full markdown content.',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Conversation ID (e.g., "content_042")',
              },
            },
            required: ['id'],
          },
        },
        {
          name: 'get_categories',
          description: 'List all available categories/folders in the memory graph. Use this to discover what topics are available.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_memory':
            return await this.searchMemory(
              (args?.query as string) || '',
              Math.floor((args?.limit as number) || 10)
            );

          case 'get_by_category':
            return await this.getByCategory(
              (args?.category as string) || '',
              Math.floor((args?.limit as number) || 20)
            );

          case 'get_conversation':
            return await this.getConversation((args?.id as string) || '');

          case 'get_categories':
            return await this.getCategories();

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'hippocamp://categories',
          name: 'Memory Categories',
          description: 'Complete category/folder tree',
          mimeType: 'application/json',
        },
        {
          uri: 'hippocamp://stats',
          name: 'Memory Statistics',
          description: 'Statistics about the memory graph',
          mimeType: 'application/json',
        },
      ],
    }));

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === 'hippocamp://categories') {
        const categories = await this.neo4jStore.getAllCategories();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(categories, null, 2),
            },
          ],
        };
      }

      if (uri === 'hippocamp://stats') {
        const stats = await this.neo4jStore.getStats();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  private async searchMemory(query: string, limit: number = 10) {
    const results = await this.neo4jStore.searchMemory(query, limit);

    return {
      content: [
        {
          type: 'text',
          text: this.formatSearchResults(results, query),
        },
      ],
    };
  }

  private async getByCategory(category: string, limit: number = 20) {
    const results = await this.neo4jStore.getByCategory(category, limit);

    return {
      content: [
        {
          type: 'text',
          text: this.formatCategoryResults(results, category),
        },
      ],
    };
  }

  private async getConversation(id: string) {
    const conversation = await this.neo4jStore.getConversation(id);

    if (!conversation) {
      return {
        content: [
          {
            type: 'text',
            text: `Conversation ${id} not found.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: this.formatConversation(conversation),
        },
      ],
    };
  }

  private async getCategories() {
    const categories = await this.neo4jStore.getAllCategories();

    return {
      content: [
        {
          type: 'text',
          text: this.formatCategories(categories),
        },
      ],
      _meta: {
        hippocamp_version: '0.1.1',
        server_pid: process.pid
      }
    };
  }

  private formatSearchResults(results: any[], query: string): string {
    if (results.length === 0) {
      return `No memories found for query: "${query}"`;
    }

    let output = `Found ${results.length} memories matching "${query}":\n\n`;

    for (const result of results) {
      output += `### ${result.title}\n`;
      output += `**Category**: ${result.category}\n`;
      output += `**ID**: ${result.id}\n`;
      if (result.snippet) {
        output += `**Preview**: ${result.snippet.substring(0, 200)}...\n`;
      }
      output += `\n---\n\n`;
    }

    return output;
  }

  private formatCategoryResults(results: any[], category: string): string {
    if (results.length === 0) {
      return `No memories found in category: "${category}"`;
    }

    let output = `Found ${results.length} memories in "${category}":\n\n`;

    for (const result of results) {
      output += `### ${result.title}\n`;
      output += `**ID**: ${result.id}\n`;
      if (result.snippet) {
        output += `**Preview**: ${result.snippet.substring(0, 150)}...\n`;
      }
      output += `\n`;
    }

    return output;
  }

  private formatConversation(conversation: any): string {
    let output = `# ${conversation.title}\n\n`;
    output += `**Category**: ${conversation.category}\n`;
    output += `**ID**: ${conversation.id}\n`;
    output += `**Timestamp**: ${conversation.timestamp}\n\n`;
    output += `---\n\n`;
    output += conversation.text;

    return output;
  }

  private formatCategories(categories: any[]): string {
    let output = `# Memory Categories\n\n`;
    output += `Total categories: ${categories.length}\n\n`;

    for (const cat of categories) {
      const indent = '  '.repeat(cat.depth || 0);
      output += `${indent}- **${cat.name}** (${cat.count || 0} memories)\n`;
    }

    return output;
  }

  async run() {
    try {
      // Connect to databases
      await this.neo4jStore.connect();
      await this.redisCache.connect();

      const VERSION = '0.1.1';  // Incremented after Math.floor() parameter fix
      const BUILD_DATE = '2025-01-10';

      console.error('='.repeat(80));
      console.error('Hippocamp MCP Server starting...');
      console.error(`Version: ${VERSION} (Build: ${BUILD_DATE})`);
      console.error(`Neo4j: ${NEO4J_URI}`);
      console.error(`Redis: ${REDIS_HOST}:${REDIS_PORT}`);
      console.error(`Process: PID ${process.pid} | Started: ${new Date().toISOString()}`);
      console.error('='.repeat(80));

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      console.error('Hippocamp ready! 🦛');
    } catch (error) {
      console.error('Failed to start Hippocamp:', error);
      process.exit(1);
    }
  }

  async close() {
    await this.neo4jStore.close();
    await this.redisCache.close();
  }
}

// Start the server
const server = new HippocampServer();

process.on('SIGINT', async () => {
  console.error('\nShutting down Hippocamp...');
  await server.close();
  process.exit(0);
});

server.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
