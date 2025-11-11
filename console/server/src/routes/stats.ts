import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// GET /api/stats - Get memory statistics
router.get('/', async (req: Request, res: Response) => {
  try {
    const neo4jStore = req.app.locals.neo4jStore;

    // Get categories with counts
    const categories = await neo4jStore.getCategories();

    // Sort by count descending
    const topCategories = categories
      .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
      .slice(0, 10)
      .map((c: any) => ({
        name: c.name,
        count: c.count || 0
      }));

    // Calculate total conversations
    const totalConversations = categories.reduce((sum: number, c: any) => sum + (c.count || 0), 0);

    // TODO: Add timeline data (would require timestamp analysis in Neo4j)
    // For now, return placeholder
    const timeline = [
      { month: '2024-05', count: Math.floor(totalConversations * 0.15) },
      { month: '2024-06', count: Math.floor(totalConversations * 0.18) },
      { month: '2024-07', count: Math.floor(totalConversations * 0.20) },
      { month: '2024-08', count: Math.floor(totalConversations * 0.17) },
      { month: '2024-09', count: Math.floor(totalConversations * 0.15) },
      { month: '2024-10', count: Math.floor(totalConversations * 0.15) }
    ];

    res.json({
      totalConversations,
      totalCategories: categories.length,
      topCategories,
      timeline
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
  }
});

export default router;
