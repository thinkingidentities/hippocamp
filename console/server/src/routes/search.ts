import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, limit = '10', category } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const neo4jStore = req.app.locals.neo4jStore;
    const maxResults = parseInt(limit as string, 10);

    // Search using existing Neo4j store
    let results = await neo4jStore.searchMemory(q, maxResults);

    // Filter by category if specified
    if (category && typeof category === 'string') {
      results = results.filter((r: any) => r.category === category);
    }

    res.json({
      results: results.map((r: any) => ({
        id: r.id,
        title: r.title,
        snippet: r.snippet || r.text?.substring(0, 200) + '...',
        category: r.category,
        score: r.score || 1.0,
        timestamp: r.timestamp
      })),
      total: results.length,
      query: q
    });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

export default router;
