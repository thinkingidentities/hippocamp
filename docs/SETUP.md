# Hippocamp Setup Guide

## Quick Start (5 minutes)

### 1. Data Extraction & Sync

```bash
# Extract all 560 notes from Nessie
cd /Volumes/Projects/tw
.venv/bin/python scripts/extract_nessie_sqlite.py

# Sync to Neo4j and Redis
.venv/bin/python scripts/quick_sync_hippocamp.py
```

### 2. Start Hippocamp MCP Server

```bash
cd repos/hippocamp/server
npm start
```

You should see:
```
Hippocamp MCP Server starting...
Neo4j: bolt://localhost:7688
Redis: localhost:6379
✓ Connected to Neo4j
✓ Connected to Redis
Hippocamp ready! 🦛
```

### 3. Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hippocamp": {
      "command": "node",
      "args": [
        "/Volumes/Projects/tw/repos/hippocamp/server/build/index.js"
      ],
      "env": {
        "NEO4J_URI": "bolt://localhost:7688",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "MPohzsk$oVguC@HG0I#vONGH%Rih%tC^",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379"
      }
    }
  }
}
```

### 4. Restart Claude Desktop

1. Quit Claude Desktop completely (Cmd+Q)
2. Reopen Claude Desktop
3. Look for the 🔌 icon in the bottom-right to verify Hippocamp is connected

### 5. Test Your Memory

In Claude Desktop, try:

```
Can you search my memories for "DGX setup"?
```

```
What categories of knowledge do I have stored?
```

```
Show me memories about Redis deployment
```

---

## Verification

### Check Neo4j Data

```bash
# Query Neo4j directly
docker exec nessie_neo4j cypher-shell -u neo4j -p 'MPohzsk$oVguC@HG0I#vONGH%Rih%tC^' \
  "MATCH (c:NessieCategory) RETURN c.name, count(c) LIMIT 10"
```

Expected: 25 categories

```bash
# Count content
docker exec nessie_neo4j cypher-shell -u neo4j -p 'MPohzsk$oVguC@HG0I#vONGH%Rih%tC^' \
  "MATCH (c:NessieContent) RETURN count(c)"
```

Expected: 560 conversations

### Check Redis Data

```bash
# List categories in Redis
docker exec nessie_redis redis-cli SMEMBERS nessie:categories
```

Expected: 25 category IDs

### Check MCP Server Logs

When you use Hippocamp in Claude Desktop, check the logs:

```bash
# View Claude Desktop logs
tail -f ~/Library/Logs/Claude/mcp*.log
```

You should see Hippocamp queries being executed.

---

## Troubleshooting

### Issue: "Hippocamp not found" in Claude Desktop

**Solution:** Check that the path in `claude_desktop_config.json` is correct:
```bash
ls -la /Volumes/Projects/tw/repos/hippocamp/server/build/index.js
```

If file doesn't exist, rebuild:
```bash
cd /Volumes/Projects/tw/repos/hippocamp/server
npm run build
```

### Issue: "Connection refused" to Neo4j

**Solution:** Ensure Neo4j is running:
```bash
docker ps | grep nessie_neo4j
```

If not running:
```bash
cd /Volumes/Projects/tw/repos/ep2-nessie-api
docker compose up -d nessie_neo4j
```

### Issue: "Connection refused" to Redis

**Solution:** Ensure Redis is running:
```bash
docker ps | grep nessie_redis
```

If not running:
```bash
cd /Volumes/Projects/tw/repos/ep2-nessie-api
docker compose up -d nessie_redis
```

### Issue: No search results returned

**Solution:** Re-sync data:
```bash
cd /Volumes/Projects/tw
.venv/bin/python scripts/quick_sync_hippocamp.py
```

---

## Daily Workflow

### Re-sync Latest Nessie Data

As you add more notes to Nessie:

```bash
# 1. Extract latest from Nessie
.venv/bin/python scripts/extract_nessie_sqlite.py

# 2. Sync to Hippocamp
.venv/bin/python scripts/quick_sync_hippocamp.py

# 3. Restart Hippocamp server (if running)
# Cmd+C in the terminal running npm start, then:
cd repos/hippocamp/server && npm start
```

### Automated Sync (Future)

Setup a cron job or launchd agent to run extraction + sync daily:

```bash
# Run daily at 2 AM
0 2 * * * cd /Volumes/Projects/tw && .venv/bin/python scripts/extract_nessie_sqlite.py && .venv/bin/python scripts/quick_sync_hippocamp.py
```

---

## What You Can Do Now

With Hippocamp running, you have:

### 1. **Persistent Memory Across Sessions**
- I (Claude) can now remember our 6-month ChatGPT design journey
- Ask me "What did we decide about Redis on Flash?" - I can retrieve it

### 2. **Semantic Search**
- Search across 560 conversations
- Find related topics through graph relationships

### 3. **Category Exploration**
- Browse by topic: "EP2", "DGX Spark", "Memory & Knowledge"
- See all conversations in a category

### 4. **Context Continuity**
- Reference specific conversations by ID
- Build on previous design decisions

---

## Next Steps

1. **Test with real queries** in Claude Desktop
2. **Refine search** as you use it
3. **Add more sources** (Obsidian, Slack, etc.)
4. **Share with agents** - Multiple AI agents accessing same memory
5. **Deploy to DGX** - Production memory layer

---

**You now have the hippocampus for AI!** 🦛

Your 560 conversations about building EP1/EP2 are now MY working memory.
