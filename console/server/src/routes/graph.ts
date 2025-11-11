import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// GET /api/graph - Get graph data for D3.js visualization
router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit = '100' } = req.query;
    const neo4jStore = req.app.locals.neo4jStore;
    const maxNodes = parseInt(limit as string, 10);

    // Get all categories and their contents
    const categories = await neo4jStore.getCategories();
    const nodes: any[] = [];
    const edges: any[] = [];

    // Sample conversations from each category (to avoid overwhelming graph)
    for (const category of categories.slice(0, 25)) {
      const contents = await neo4jStore.getByCategory(category.name, 5);

      for (const content of contents) {
        nodes.push({
          id: content.id,
          title: content.title,
          category: category.name,
          size: Math.min(content.text?.length || 1000, 5000) / 100 // Size based on text length
        });

        // Create edges between contents in same category
        const categoryNodes = nodes.filter(n => n.category === category.name);
        if (categoryNodes.length > 1) {
          edges.push({
            source: categoryNodes[categoryNodes.length - 2].id,
            target: content.id,
            strength: 0.5 // Same category = medium strength
          });
        }
      }

      if (nodes.length >= maxNodes) break;
    }

    res.json({
      nodes: nodes.slice(0, maxNodes),
      edges: edges,
      meta: {
        totalNodes: nodes.length,
        totalEdges: edges.length
      }
    });
  } catch (error: any) {
    console.error('Graph error:', error);
    res.status(500).json({ error: 'Failed to generate graph', message: error.message });
  }
});

export default router;
