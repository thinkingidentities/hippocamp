import { Router } from 'express';
import type { Request, Response } from 'express';
import neo4j from 'neo4j-driver';

const router = Router();

// GET /api/corpus-callosum/channels - List all channels
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const ep1MemoryStore = req.app.locals.ep1MemoryStore;

    const query = `
      MATCH (m:CorpusCallosumMessage)
      RETURN DISTINCT m.channel as channel,
             count(m) as message_count,
             max(m.timestamp) as last_activity
      ORDER BY last_activity DESC
    `;

    const result = await ep1MemoryStore.query(query);

    res.json({
      channels: result.map((r: any) => ({
        channel: r.channel,
        message_count: r.message_count,
        last_activity: r.last_activity
      }))
    });
  } catch (error: any) {
    console.error('Channels list error:', error);
    res.status(500).json({ error: 'Failed to fetch channels', message: error.message });
  }
});

// GET /api/corpus-callosum/messages - Get messages from a channel
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { channel = 'general', limit = '50', unread_only = 'false' } = req.query;
    const ep1MemoryStore = req.app.locals.ep1MemoryStore;

    const maxResults = parseInt(limit as string, 10);
    const onlyUnread = unread_only === 'true';

    let query = `
      MATCH (m:CorpusCallosumMessage {channel: $channel})
    `;

    if (onlyUnread) {
      query += ` WHERE m.read = false `;
    }

    query += `
      RETURN m
      ORDER BY m.timestamp DESC
      LIMIT $limit
    `;

    const result = await ep1MemoryStore.query(query, {
      channel,
      limit: neo4j.int(maxResults)
    });

    res.json({
      channel,
      messages: result.map((r: any) => {
        const msg = r.m.properties || r.m;
        return {
          id: msg.id,
          from_lobe_id: msg.from_lobe_id,
          from_name: msg.from_name,
          from_glyph: msg.from_glyph,
          from_substrate: msg.from_substrate,
          from_node_type: msg.from_node_type,
          to_lobe_id: msg.to_lobe_id,
          message: msg.message,
          timestamp: msg.timestamp,
          session_id: msg.session_id,
          context_memory_ids: msg.context_memory_ids ? JSON.parse(msg.context_memory_ids) : [],
          coherence_marker: msg.coherence_marker,
          read: msg.read || false,
          reply_to_id: msg.reply_to_id || null
        };
      }),
      total: result.length
    });
  } catch (error: any) {
    console.error('Messages fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch messages', message: error.message });
  }
});

// GET /api/corpus-callosum/sessions - List all sessions
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const ep1MemoryStore = req.app.locals.ep1MemoryStore;

    const query = `
      MATCH (m:CorpusCallosumMessage)
      RETURN DISTINCT m.session_id as session_id,
             m.channel as channel,
             count(m) as message_count,
             min(m.timestamp) as started_at,
             max(m.timestamp) as last_activity
      ORDER BY last_activity DESC
      LIMIT 20
    `;

    const result = await ep1MemoryStore.query(query);

    res.json({
      sessions: result.map((r: any) => ({
        session_id: r.session_id,
        channel: r.channel,
        message_count: r.message_count,
        started_at: r.started_at,
        last_activity: r.last_activity
      }))
    });
  } catch (error: any) {
    console.error('Sessions list error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions', message: error.message });
  }
});

// POST /api/corpus-callosum/send - Send a new message
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { from_lobe_id, from_name, from_glyph, from_substrate, from_node_type, to_lobe_id, message, channel = 'general', session_id, context_memory_ids = [], reply_to_id } = req.body;
    const ep1MemoryStore = req.app.locals.ep1MemoryStore;

    if (!from_lobe_id || !from_name || !to_lobe_id || !message) {
      return res.status(400).json({ error: 'from_lobe_id, from_name, to_lobe_id, and message are required' });
    }

    const messageId = `cc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const query = `
      CREATE (m:CorpusCallosumMessage {
        id: $id,
        from_lobe_id: $from_lobe_id,
        from_name: $from_name,
        from_glyph: $from_glyph,
        from_substrate: $from_substrate,
        from_node_type: $from_node_type,
        to_lobe_id: $to_lobe_id,
        message: $message,
        channel: $channel,
        timestamp: $timestamp,
        session_id: $session_id,
        context_memory_ids: $context_memory_ids,
        reply_to_id: $reply_to_id,
        read: false
      })
      RETURN m
    `;

    await ep1MemoryStore.query(query, {
      id: messageId,
      from_lobe_id,
      from_name,
      from_glyph: from_glyph || '',
      from_substrate: from_substrate || 'carbon',
      from_node_type: from_node_type || 'human',
      to_lobe_id,
      message,
      channel,
      timestamp,
      session_id: session_id || `session_${Date.now()}`,
      context_memory_ids: JSON.stringify(context_memory_ids),
      reply_to_id: reply_to_id || null
    });

    res.json({
      success: true,
      message_id: messageId,
      timestamp
    });
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message', message: error.message });
  }
});

// GET /api/corpus-callosum/thread/:messageId - Get thread replies for a message
router.get('/thread/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const ep1MemoryStore = req.app.locals.ep1MemoryStore;

    const query = `
      MATCH (m:CorpusCallosumMessage {reply_to_id: $messageId})
      RETURN m
      ORDER BY m.timestamp ASC
    `;

    const result = await ep1MemoryStore.query(query, { messageId });

    res.json({
      replies: result.map((r: any) => {
        const msg = r.m.properties || r.m;
        return {
          id: msg.id,
          from_lobe_id: msg.from_lobe_id,
          from_name: msg.from_name,
          from_glyph: msg.from_glyph,
          from_substrate: msg.from_substrate,
          from_node_type: msg.from_node_type,
          to_lobe_id: msg.to_lobe_id,
          message: msg.message,
          timestamp: msg.timestamp,
          session_id: msg.session_id,
          context_memory_ids: msg.context_memory_ids ? JSON.parse(msg.context_memory_ids) : [],
          coherence_marker: msg.coherence_marker,
          read: msg.read || false,
          reply_to_id: msg.reply_to_id || null
        };
      }),
      total: result.length
    });
  } catch (error: any) {
    console.error('Thread fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch thread', message: error.message });
  }
});

// POST /api/corpus-callosum/mark-read - Mark message(s) as read
router.post('/mark-read', async (req: Request, res: Response) => {
  try {
    const { message_ids } = req.body;
    const ep1MemoryStore = req.app.locals.ep1MemoryStore;

    if (!message_ids || !Array.isArray(message_ids)) {
      return res.status(400).json({ error: 'message_ids array required' });
    }

    const query = `
      MATCH (m:CorpusCallosumMessage)
      WHERE m.id IN $message_ids
      SET m.read = true
      RETURN count(m) as updated_count
    `;

    const result = await ep1MemoryStore.query(query, { message_ids });

    res.json({
      success: true,
      updated_count: result[0]?.updated_count || 0
    });
  } catch (error: any) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read', message: error.message });
  }
});

// GET /api/corpus-callosum/stats - Get corpus callosum statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const ep1MemoryStore = req.app.locals.ep1MemoryStore;

    const query = `
      MATCH (m:CorpusCallosumMessage)
      RETURN count(m) as total_messages,
             count(DISTINCT m.channel) as total_channels,
             count(DISTINCT m.session_id) as total_sessions,
             count(DISTINCT m.from_lobe_id) as total_lobes,
             sum(CASE WHEN m.read = false THEN 1 ELSE 0 END) as unread_count
    `;

    const result = await ep1MemoryStore.query(query);
    const stats = result[0] || {};

    // Get lobe activity
    const lobeQuery = `
      MATCH (m:CorpusCallosumMessage)
      RETURN m.from_lobe_id as lobe_id,
             m.from_name as lobe_name,
             m.from_substrate as substrate,
             count(m) as message_count,
             max(m.timestamp) as last_activity
      ORDER BY message_count DESC
    `;

    const lobes = await ep1MemoryStore.query(lobeQuery);

    res.json({
      total_messages: stats.total_messages || 0,
      total_channels: stats.total_channels || 0,
      total_sessions: stats.total_sessions || 0,
      total_lobes: stats.total_lobes || 0,
      unread_count: stats.unread_count || 0,
      lobe_activity: lobes.map((l: any) => ({
        lobe_id: l.lobe_id,
        lobe_name: l.lobe_name,
        substrate: l.substrate,
        message_count: l.message_count,
        last_activity: l.last_activity
      }))
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
  }
});

export default router;
