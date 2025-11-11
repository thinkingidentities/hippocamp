import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

// GET /api/conversations/:id - Get full conversation by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const neo4jStore = req.app.locals.neo4jStore;

    const conversation = await neo4jStore.getConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      id: conversation.id,
      title: conversation.title,
      text: conversation.text,
      category: conversation.category,
      timestamp: conversation.timestamp,
      tags: conversation.tags || []
    });
  } catch (error: any) {
    console.error('Conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation', message: error.message });
  }
});

export default router;
