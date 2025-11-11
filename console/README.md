# Hippocamp Console

Web-based memory exploration interface for the Hippocamp memory layer.

## Status: Phase 1 Complete ✅

**API Server:** Operational on `http://localhost:3001`
**Frontend:** Pending (Phase 2)

## What's Working Now

### 1. REST API Server (Express + TypeScript)

Running on port 3001 with the following endpoints:

#### `GET /api/search?q={query}&limit={n}`
Full-text search across all 560 conversations
```bash
curl "http://localhost:3001/api/search?q=DGX&limit=3"
```

#### `GET /api/categories`
List all 25 categories with memory counts
```bash
curl "http://localhost:3001/api/categories"
```

#### `GET /api/categories/{id}/contents`
Get conversations in a specific category
```bash
curl "http://localhost:3001/api/categories/cat_dgxspark/contents?limit=5"
```

#### `GET /api/conversations/{id}`
Get full conversation by ID
```bash
curl "http://localhost:3001/api/conversations/content_042"
```

#### `GET /api/graph`
Get graph data for D3.js visualization (nodes + edges)
```bash
curl "http://localhost:3001/api/graph?limit=50"
```

#### `GET /api/stats`
Get memory statistics and metrics
```bash
curl "http://localhost:3001/api/stats"
```

#### `GET /api/corpus-callosum/channels`
List all inter-lobe communication channels
```bash
curl "http://localhost:3001/api/corpus-callosum/channels"
```

#### `GET /api/corpus-callosum/messages?channel=general&limit=50`
Get messages from corpus callosum channel
```bash
curl "http://localhost:3001/api/corpus-callosum/messages?channel=general&limit=50"
```

#### `GET /api/corpus-callosum/sessions`
List all corpus callosum sessions
```bash
curl "http://localhost:3001/api/corpus-callosum/sessions"
```

#### `GET /api/corpus-callosum/stats`
Get corpus callosum statistics (lobes, channels, unread count)
```bash
curl "http://localhost:3001/api/corpus-callosum/stats"
```

#### `POST /api/corpus-callosum/send`
Send a new message to the corpus callosum
```bash
curl -X POST "http://localhost:3001/api/corpus-callosum/send" \
  -H "Content-Type: application/json" \
  -d '{
    "from_lobe_id": "user_001",
    "from_name": "Carbon User",
    "from_glyph": "👤",
    "to_lobe_id": "claude_desktop",
    "message": "Hello from the browser!",
    "channel": "general"
  }'
```

#### `POST /api/corpus-callosum/mark-read`
Mark messages as read
```bash
curl -X POST "http://localhost:3001/api/corpus-callosum/mark-read" \
  -H "Content-Type: application/json" \
  -d '{"message_ids": ["cc_abc123", "cc_def456"]}'
```

#### `GET /health`
Health check endpoint
```bash
curl "http://localhost:3001/health"
```

## Architecture

```
console/
├── server/              # Express REST API
│   ├── src/
│   │   ├── index.ts     # Main server
│   │   ├── routes/      # API endpoints
│   │   │   ├── search.ts
│   │   │   ├── categories.ts
│   │   │   ├── conversations.ts
│   │   │   ├── graph.ts
│   │   │   └── stats.ts
│   │   └── stores/      # Neo4j + Redis (shared with MCP server)
│   │       ├── neo4j-store.ts
│   │       └── redis-cache.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── start.sh         # Startup script with vault credentials
└── web/                 # React frontend (TODO: Phase 2)
```

## Running the Server

### Option 1: Using start script (recommended)
```bash
cd repos/hippocamp/console/server
./start.sh
```

### Option 2: Manual with environment variables
```bash
cd repos/hippocamp/console/server

export NEO4J_URI="bolt://localhost:7688"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="$(cd /Volumes/Projects/tw && .venv/bin/python -c 'from infra.secrets import TWVault; v=TWVault(); print(v.get_nessie_neo4j_credentials()[\"password\"])')"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export PORT="3001"

npm run dev
```

## Testing the API

### Search for DGX-related memories
```bash
curl -s "http://localhost:3001/api/search?q=DGX&limit=5" | jq '.results[] | {title, category}'
```

Output:
```json
{
  "title": "EP2 DGX Memory Layer Setup",
  "category": "Infrastructure"
}
{
  "title": "ComfyUI DGX Setup & Remote Control",
  "category": "DGX Spark"
}
```

### List top categories
```bash
curl -s "http://localhost:3001/api/categories" | jq '.categories[:10] | .[] | {name, count}'
```

Output:
```json
{
  "name": "Ring & Cognates",
  "count": 109
}
{
  "name": "Integration",
  "count": 84
}
{
  "name": "Memory & Knowledge",
  "count": 67
}
```

### Get memory stats
```bash
curl -s "http://localhost:3001/api/stats" | jq
```

Output:
```json
{
  "totalConversations": 560,
  "totalCategories": 25,
  "topCategories": [
    {"name": "Ring & Cognates", "count": 109},
    {"name": "Integration", "count": 84}
  ]
}
```

## Dependencies

The Console API server reuses the same data stores as the Hippocamp MCP server:
- **Neo4j** - Graph database (`bolt://localhost:7688`)
- **Redis** - Cache layer (`localhost:6379`)

## Security

- Credentials loaded from 1Password vault (`TWVault-ep2lab`)
- No secrets in source code
- CORS enabled for local development

## Next Steps (Phase 2)

1. **React Frontend**
   - Create Vite + React app in `console/web/`
   - Implement components:
     - MemoryMap (D3.js visualization)
     - SearchBar (fuzzy search)
     - CategoryBrowser (tree view)
     - ConversationReader (markdown)
     - StatsDashboard (metrics)

2. **Deployment**
   - Production build
   - Docker containerization
   - Deploy to DGX

3. **Enhancements**
   - Natural language query layer
   - CLI tool
   - Multi-agent access

## Documentation

See [CONSOLE_PLAN.md](../docs/CONSOLE_PLAN.md) for complete implementation plan.

---

**Current Status:** API layer complete, ready for frontend development
