# Hippocamp Architecture

## Overview

**Hippocamp** is the memory layer for AI agents, providing persistent episodic and semantic memory through a graph-based knowledge store accessible via the Model Context Protocol (MCP).

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│ Data Sources                                                │
│ • Nessie SQLite (560 ChatGPT conversations)                │
│ • Future: Obsidian, Slack, custom sources                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓ (Python extraction pipeline)
┌─────────────────────────────────────────────────────────────┐
│ Knowledge Graph Layer                                       │
│                                                             │
│  Neo4j (bolt://localhost:7688)                            │
│  • Nodes: NessieCategory, NessieContent                   │
│  • Relationships: CONTAINS, HAS_SUBCATEGORY               │
│  • Indexes: Full-text search, category lookups           │
│  • Storage: 560 conversations, 25 categories              │
│                                                             │
│  Redis (localhost:6379)                                    │
│  • Cache: Category trees, search results                  │
│  • Analytics: Popular searches                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓ (MCP protocol)
┌─────────────────────────────────────────────────────────────┐
│ Hippocamp MCP Server (Node.js/TypeScript)                  │
│                                                             │
│  Tools:                                                     │
│  • search_memory(query, limit)                            │
│  • get_by_category(category, limit)                       │
│  • get_conversation(id)                                    │
│  • get_categories()                                        │
│                                                             │
│  Resources:                                                 │
│  • hippocamp://categories (category tree)                 │
│  • hippocamp://stats (memory statistics)                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓ (stdio transport)
┌─────────────────────────────────────────────────────────────┐
│ Claude Desktop / Code / API                                 │
│ • Persistent memory across sessions                         │
│ • Semantic search of conversation history                   │
│ • Context-aware assistance                                  │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### Neo4j Schema

**Nodes:**

```cypher
// Category node (folders/topics)
(:NessieCategory {
  id: string,          // Unique ID
  name: string,        // Display name
  depth: string        // Hierarchy depth
})

// Content node (conversations)
(:NessieContent {
  id: string,          // Unique ID (content_001, etc.)
  title: string,       // Conversation title
  text: string,        // Full markdown content
  snippet: string,     // Preview text
  timestamp: string    // ISO8601 timestamp
})
```

**Relationships:**

```cypher
// Category contains content
(:NessieCategory)-[:CONTAINS]->(:NessieContent)

// Category hierarchy (future)
(:NessieCategory)-[:HAS_SUBCATEGORY]->(:NessieCategory)
```

**Indexes:**

```cypher
// Uniqueness constraints
CREATE CONSTRAINT nessie_category_id ON (c:NessieCategory) ASSERT c.id IS UNIQUE;
CREATE CONSTRAINT nessie_content_id ON (c:NessieContent) ASSERT c.id IS UNIQUE;

// Search indexes
CREATE INDEX nessie_category_name ON :NessieCategory(name);
CREATE INDEX nessie_content_title ON :NessieContent(title);
CREATE INDEX nessie_content_timestamp ON :NessieContent(timestamp);

// Full-text search
CREATE FULLTEXT INDEX nessie_content_fulltext
FOR (c:NessieContent) ON EACH [c.title, c.text];
```

### Redis Schema

**Keys:**

```
nessie:categories              # SET of category IDs
nessie:category:{id}           # HASH of category data
hippocamp:categories:tree      # JSON of category tree (cached)
hippocamp:search:{query}       # Cached search results
hippocamp:search:popular       # ZSET of popular searches
```

## Data Flow

### Extraction Pipeline (Python)

```
1. extract_nessie_sqlite.py
   ↓
   Reads: ~/Library/Containers/.../notes.sqlite
   Extracts: 560 notes, 25 folders, full markdown
   Outputs: /tmp/nessie_data.json (1.72 MB)

2. quick_sync_hippocamp.py
   ↓
   Reads: /tmp/nessie_data.json
   Syncs to: Neo4j (graph) + Redis (cache)
   Creates: 560 nodes, 560 relationships, 25 categories
```

### Query Pipeline (TypeScript)

```
1. Claude Desktop sends MCP request
   ↓
2. Hippocamp MCP Server receives tool call
   ↓
3. Neo4jMemoryStore.searchMemory(query)
   ↓
4. Cypher query with full-text search
   ↓
5. Results formatted as markdown
   ↓
6. Response sent back to Claude Desktop
```

## MCP Protocol Details

### Tool Call Example

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "search_memory",
    "arguments": {
      "query": "DGX Redis setup",
      "limit": 10
    }
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 8 memories matching \"DGX Redis setup\":\n\n### Redis Enterprise: DGX Spark + ThunderBlade Stack S...\n**Category**: DGX Spark\n**ID**: content_042\n**Preview**: Complete Redis Enterprise setup on DGX...\n\n---\n\n..."
    }
  ]
}
```

## Performance Characteristics

### Query Performance

- **Full-text search**: ~50-200ms (560 documents)
- **Category lookup**: ~10-50ms (indexed)
- **Direct conversation retrieval**: ~5-20ms (by ID)
- **Category tree**: <5ms (Redis cached)

### Scalability

**Current capacity:**
- 560 conversations
- 25 categories
- ~1.72 MB text data
- Neo4j: ~50MB database size

**Projected scaling:**
- 10K conversations: ~200ms search
- 100K conversations: ~500ms search
- 1M conversations: Requires sharding

## Security Model

### Credentials

- Neo4j: Username/password authentication
- Redis: No authentication (local only)
- MCP: stdio transport (local only)

### Data Privacy

- **All data local**: No external API calls
- **No telemetry**: Zero tracking or analytics
- **User-controlled**: Data never leaves local machine

## Extension Points

### Adding New Data Sources

1. Create extractor in `sync/`
2. Output to same JSON schema:
   ```json
   {
     "root_categories": [...],
     "contents": [...]
   }
   ```
3. Run `quick_sync_hippocamp.py`

### Adding New Tools

1. Add tool definition in `server/src/index.ts`
2. Implement handler method
3. Add corresponding Neo4j query
4. Rebuild and restart

### Multi-Agent Support (Future)

```
Hippocamp Server
    ↓
Multiple MCP connections:
    • Claude Desktop (User A)
    • Claude API (Agent 1)
    • Claude API (Agent 2)
    • Custom agents via MCP SDK
```

## Future Architecture

### Phase 2: Distributed Memory

```
Local Hippocamp
    ↓ (sync protocol)
Central Memory Commons
    ↓ (federation)
Other Hippocamp instances
```

### Phase 3: Trust Layer

```
Memory + Provenance
    ↓
Verified knowledge graph
    ↓
Trust economy foundation
```

---

**Current Status:** Phase 1 complete - Local MCP server operational
**Next:** Phase 2 - Multi-agent memory sharing
**Vision:** Distributed memory commons for aligned AI agents
