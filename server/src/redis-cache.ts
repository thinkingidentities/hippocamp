/**
 * Redis Cache Layer
 *
 * Provides fast caching for frequently accessed data:
 * - Category trees
 * - Popular search results
 * - Recently accessed conversations
 */

import { createClient, RedisClientType } from 'redis';

export class RedisCache {
  private client: RedisClientType | null = null;
  private host: string;
  private port: number;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    this.client = createClient({
      socket: {
        host: this.host,
        port: this.port,
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis error:', err);
    });

    await this.client.connect();
    console.error('✓ Connected to Redis');
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  private getClient(): RedisClientType {
    if (!this.client) {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  /**
   * Cache category tree
   */
  async cacheCategories(categories: any[]): Promise<void> {
    const client = this.getClient();
    const key = 'hippocamp:categories:tree';
    await client.set(key, JSON.stringify(categories), {
      EX: 3600, // 1 hour TTL
    });
  }

  /**
   * Get cached category tree
   */
  async getCachedCategories(): Promise<any[] | null> {
    const client = this.getClient();
    const key = 'hippocamp:categories:tree';
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Cache search results
   */
  async cacheSearchResults(query: string, results: any[]): Promise<void> {
    const client = this.getClient();
    const key = `hippocamp:search:${query}`;
    await client.set(key, JSON.stringify(results), {
      EX: 300, // 5 minutes TTL
    });
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(query: string): Promise<any[] | null> {
    const client = this.getClient();
    const key = `hippocamp:search:${query}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Track popular searches
   */
  async trackSearch(query: string): Promise<void> {
    const client = this.getClient();
    const key = 'hippocamp:search:popular';
    await client.zIncrBy(key, 1, query);
  }

  /**
   * Get popular searches
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    const client = this.getClient();
    const key = 'hippocamp:search:popular';
    return await client.zRange(key, 0, limit - 1, { REV: true });
  }
}
