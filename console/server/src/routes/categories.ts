import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// GET /api/categories - List all categories
router.get('/', async (req: Request, res: Response) => {
  try {
    const neo4jStore = req.app.locals.neo4jStore;
    const categories = await neo4jStore.getAllCategories();

    res.json({
      categories: categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        count: c.count || 0,
        depth: c.depth || '0'
      })),
      total: categories.length
    });
  } catch (error: any) {
    console.error('Categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories', message: error.message });
  }
});

// GET /api/categories/:id/contents - Get contents in a category
router.get('/:id/contents', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '20' } = req.query;

    const neo4jStore = req.app.locals.neo4jStore;
    const maxResults = parseInt(limit as string, 10);

    // Get category name first
    const categories = await neo4jStore.getAllCategories();
    const category = categories.find((c: any) => c.id === id);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get contents in category
    const contents = await neo4jStore.getByCategory(category.name, maxResults);

    res.json({
      category: category.name,
      contents: contents.map((c: any) => ({
        id: c.id,
        title: c.title,
        snippet: c.snippet || c.text?.substring(0, 200) + '...',
        timestamp: c.timestamp
      })),
      total: contents.length
    });
  } catch (error: any) {
    console.error('Category contents error:', error);
    res.status(500).json({ error: 'Failed to fetch category contents', message: error.message });
  }
});

export default router;
