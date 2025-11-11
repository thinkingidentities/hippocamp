#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { Neo4jMemoryStore } from './stores/neo4j-store.js';
import { RedisCache } from './stores/redis-cache.js';
import searchRouter from './routes/search.js';
import categoriesRouter from './routes/categories.js';
import conversationsRouter from './routes/conversations.js';
import graphRouter from './routes/graph.js';
import statsRouter from './routes/stats.js';
import corpusCallosumRouter from './routes/corpus-callosum.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize stores
// Nessie database - Hippocamp memories (port 7688)
const neo4jStore = new Neo4jMemoryStore(
  process.env.NEO4J_URI || 'bolt://localhost:7688',
  process.env.NEO4J_USER || 'neo4j',
  process.env.NEO4J_PASSWORD || ''
);

// ep1-memory database - Corpus Callosum messages (port 7687)
const ep1MemoryStore = new Neo4jMemoryStore(
  'bolt://localhost:7687',
  'neo4j',
  'ep1-memory-strong-password-2025'
);

const redisCache = new RedisCache(
  process.env.REDIS_HOST || 'localhost',
  parseInt(process.env.REDIS_PORT || '6379')
);

// Initialize connections
async function initializeStores() {
  await neo4jStore.connect();
  await ep1MemoryStore.connect();
  await redisCache.connect();
  console.error('✓ Connected to Nessie Neo4j (7688)');
  console.error('✓ Connected to ep1-memory Neo4j (7687)');
  console.error('✓ Connected to Redis');
}

// Attach stores to app locals for route access
app.locals.neo4jStore = neo4jStore;        // For Hippocamp routes
app.locals.ep1MemoryStore = ep1MemoryStore; // For Corpus Callosum routes
app.locals.redisCache = redisCache;

// Routes
app.use('/api/search', searchRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/graph', graphRouter);
app.use('/api/stats', statsRouter);
app.use('/api/corpus-callosum', corpusCallosumRouter);

// Root redirect
app.get('/', (_req, res) => {
  res.redirect('/corpus-callosum.html');
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function start() {
  await initializeStores();

  app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('Hippocamp Console API Server');
    console.log('='.repeat(60));
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Neo4j: ${process.env.NEO4J_URI || 'bolt://localhost:7688'}`);
    console.log(`Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
    console.log('='.repeat(60));
  });
}

start().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await neo4jStore.close();
  await redisCache.close();
  process.exit(0);
});
