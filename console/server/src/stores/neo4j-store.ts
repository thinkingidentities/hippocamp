/**
 * Neo4j Memory Store
 *
 * Manages the graph database layer for Hippocamp memory storage.
 * Handles queries for semantic search, category traversal, and conversation retrieval.
 */

import neo4j, { Driver, Session } from 'neo4j-driver';

export class Neo4jMemoryStore {
  private driver: Driver | null = null;
  private uri: string;
  private user: string;
  private password: string;

  constructor(uri: string, user: string, password: string) {
    this.uri = uri;
    this.user = user;
    this.password = password;
  }

  async connect(): Promise<void> {
    this.driver = neo4j.driver(this.uri, neo4j.auth.basic(this.user, this.password));

    // Verify connectivity
    const session = this.driver.session();
    try {
      await session.run('RETURN 1');
      console.error('✓ Connected to Neo4j');
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  private getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not connected');
    }
    return this.driver.session();
  }

  /**
   * Search memories using full-text search
   */
  async searchMemory(query: string, limit: number = 10): Promise<any[]> {
    const session = this.getSession();

    try {
      // Use full-text index if available, otherwise fall back to CONTAINS
      const result = await session.run(
        `
        CALL db.index.fulltext.queryNodes('nessie_content_fulltext', $query)
        YIELD node, score
        MATCH (cat:NessieCategory)-[:CONTAINS]->(node)
        RETURN node.id AS id,
               node.title AS title,
               node.text AS text,
               node.snippet AS snippet,
               cat.name AS category,
               score
        ORDER BY score DESC
        LIMIT $limit
        `,
        { query, limit: neo4j.int(limit) }
      );

      return result.records.map((record) => ({
        id: record.get('id'),
        title: record.get('title'),
        text: record.get('text'),
        snippet: record.get('snippet'),
        category: record.get('category'),
        score: record.get('score'),
      }));
    } catch (error) {
      // Fallback to simple CONTAINS search if fulltext index not available
      console.error('Fulltext search failed, using fallback:', error);

      const result = await session.run(
        `
        MATCH (cat:NessieCategory)-[:CONTAINS]->(c:NessieContent)
        WHERE c.title CONTAINS $query OR c.text CONTAINS $query
        RETURN c.id AS id,
               c.title AS title,
               c.text AS text,
               c.snippet AS snippet,
               cat.name AS category
        ORDER BY c.title
        LIMIT $limit
        `,
        { query, limit: neo4j.int(limit) }
      );

      return result.records.map((record) => ({
        id: record.get('id'),
        title: record.get('title'),
        text: record.get('text'),
        snippet: record.get('snippet'),
        category: record.get('category'),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Get all memories in a specific category
   */
  async getByCategory(categoryName: string, limit: number = 20): Promise<any[]> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (cat:NessieCategory {name: $categoryName})-[:CONTAINS]->(c:NessieContent)
        RETURN c.id AS id,
               c.title AS title,
               c.text AS text,
               c.snippet AS snippet,
               c.timestamp AS timestamp
        ORDER BY c.timestamp DESC
        LIMIT $limit
        `,
        { categoryName, limit }
      );

      return result.records.map((record) => ({
        id: record.get('id'),
        title: record.get('title'),
        text: record.get('text'),
        snippet: record.get('snippet'),
        timestamp: record.get('timestamp'),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Get a specific conversation by ID
   */
  async getConversation(id: string): Promise<any | null> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (cat:NessieCategory)-[:CONTAINS]->(c:NessieContent {id: $id})
        RETURN c.id AS id,
               c.title AS title,
               c.text AS text,
               c.snippet AS snippet,
               c.timestamp AS timestamp,
               cat.name AS category
        `,
        { id }
      );

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      return {
        id: record.get('id'),
        title: record.get('title'),
        text: record.get('text'),
        snippet: record.get('snippet'),
        timestamp: record.get('timestamp'),
        category: record.get('category'),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get all categories with memory counts
   */
  async getAllCategories(): Promise<any[]> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (cat:NessieCategory)
        OPTIONAL MATCH (cat)-[:CONTAINS]->(c:NessieContent)
        WITH cat, count(c) AS memoryCount
        RETURN cat.id AS id,
               cat.name AS name,
               cat.depth AS depth,
               memoryCount AS count
        ORDER BY cat.name
        `
      );

      return result.records.map((record) => ({
        id: record.get('id'),
        name: record.get('name'),
        depth: record.get('depth') ? parseInt(record.get('depth')) : 0,
        count: record.get('count').toNumber(),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Get memory graph statistics
   */
  async getStats(): Promise<any> {
    const session = this.getSession();

    try {
      const result = await session.run(
        `
        MATCH (cat:NessieCategory)
        WITH count(cat) AS categoryCount
        MATCH (c:NessieContent)
        RETURN categoryCount,
               count(c) AS contentCount
        `
      );

      const record = result.records[0];
      return {
        categories: record.get('categoryCount').toNumber(),
        conversations: record.get('contentCount').toNumber(),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Generic query method for custom Cypher queries
   */
  async query(cypher: string, params: Record<string, any> = {}): Promise<any[]> {
    const session = this.getSession();

    try {
      const result = await session.run(cypher, params);
      return result.records.map((record) => record.toObject());
    } finally {
      await session.close();
    }
  }
}
