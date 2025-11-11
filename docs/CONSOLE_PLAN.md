# Hippocamp Console - Memory Discovery UX

**Created:** 2025-11-08 13:45
**Status:** Ready for Implementation
**Timeline:** 6 hours

## Overview

Hippocamp Console is a React-based web dashboard for visual exploration and discovery of the 560+ conversations stored in the Hippocamp memory layer. It provides an intuitive interface for searching, browsing, and understanding the knowledge graph built from 6 months of ChatGPT design work on EP1/EP2.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Hippocamp Console (React Frontend)                          │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │  Memory Map    │  │ Search Bar     │  │   Category    │ │
│  │  (D3.js Graph) │  │ (Fuzzy Match)  │  │   Browser     │ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Conversation Reader (Markdown Viewer)                 │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │ REST API
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Hippocamp API Server (Node.js/Express)                      │
│                                                              │
│  GET  /api/search?q={query}&limit={n}                      │
│  GET  /api/categories                                        │
│  GET  /api/categories/{id}/contents                         │
│  GET  /api/conversations/{id}                               │
│  GET  /api/graph                                             │
│  GET  /api/stats                                             │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Existing Hippocamp MCP Server                               │
│ (Neo4j + Redis)                                             │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite 6** - Build tool and dev server
- **Tailwind CSS v4** - Styling
- **D3.js** - Force-directed graph visualization
- **React Markdown** - Conversation rendering
- **Zustand** - State management
- **React Router** - Navigation

### Backend
- **Node.js** - Runtime
- **Express** - REST API framework
- **TypeScript** - Type safety
- **Existing Neo4j/Redis stores** - Data layer (reuse from MCP server)

## Component Breakdown

### 1. Memory Map (D3.js Visualization)

**Purpose:** Visual graph exploration of conversation relationships

**Features:**
- Force-directed graph layout
- Nodes: Conversations (sized by importance/length)
- Edges: Category relationships, topic similarity
- Interactive: Click to view, drag to explore
- Color-coded by category
- Zoom and pan controls

**Implementation:**
```typescript
// components/MemoryMap.tsx
interface MemoryNode {
  id: string;
  title: string;
  category: string;
  size: number; // Based on text length or importance
}

interface MemoryEdge {
  source: string;
  target: string;
  strength: number; // Relationship strength
}

const MemoryMap: React.FC = () => {
  // D3 force simulation
  // Click handler -> load conversation
  // Zoom/pan controls
}
```

### 2. Search Bar

**Purpose:** Fast, intuitive search across all memories

**Features:**
- Fuzzy search with autocomplete
- Search as you type (debounced)
- Filters: category, date range, tags
- Recent searches (cached)
- Keyboard shortcuts (Cmd+K)

**Implementation:**
```typescript
// components/SearchBar.tsx
const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const handleSearch = useDebouncedCallback(async (q: string) => {
    const data = await fetch(`/api/search?q=${q}&limit=10`);
    setResults(await data.json());
  }, 300);
}
```

### 3. Category Browser

**Purpose:** Hierarchical navigation of 25 knowledge categories

**Features:**
- Tree view with expand/collapse
- Category counts (Ring & Cognates: 109, etc.)
- Nested categories (future)
- Drag-and-drop organization (future)

**Implementation:**
```typescript
// components/CategoryBrowser.tsx
interface Category {
  id: string;
  name: string;
  count: number;
  depth: number;
}

const CategoryBrowser: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(setCategories);
  }, []);
}
```

### 4. Conversation Reader

**Purpose:** Display full conversation content with markdown rendering

**Features:**
- Markdown rendering (code blocks, images, links)
- Metadata display (timestamp, category, tags)
- Export options (PDF, markdown, JSON)
- Share link generation
- Related conversations sidebar

**Implementation:**
```typescript
// components/ConversationReader.tsx
const ConversationReader: React.FC<{id: string}> = ({id}) => {
  const [conversation, setConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    fetch(`/api/conversations/${id}`)
      .then(r => r.json())
      .then(setConversation);
  }, [id]);

  return (
    <div className="conversation-reader">
      <ReactMarkdown>{conversation?.text}</ReactMarkdown>
    </div>
  );
}
```

### 5. Stats Dashboard

**Purpose:** High-level overview of memory corpus

**Features:**
- Total conversations: 560
- Total categories: 25
- Top categories (by count)
- Memory timeline (conversations over time)
- Search analytics (popular queries)

**Implementation:**
```typescript
// components/StatsDashboard.tsx
const StatsDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats);
  }, []);
}
```

## API Endpoints

### GET /api/search
```typescript
// Query: ?q={query}&limit={n}&category={cat}
// Response:
{
  "results": [
    {
      "id": "content_042",
      "title": "Redis Enterprise: DGX Spark + ThunderBlade Stack",
      "snippet": "Complete Redis Enterprise setup on DGX...",
      "category": "DGX Spark",
      "score": 0.95,
      "timestamp": "2024-10-20T14:30:00Z"
    }
  ],
  "total": 8
}
```

### GET /api/categories
```typescript
// Response:
{
  "categories": [
    {
      "id": "cat_ringcognates",
      "name": "Ring & Cognates",
      "count": 109,
      "depth": "0"
    }
  ]
}
```

### GET /api/categories/{id}/contents
```typescript
// Response:
{
  "category": "Ring & Cognates",
  "contents": [
    {
      "id": "content_001",
      "title": "Cognitive mesh for silicon collaboration",
      "snippet": "...",
      "timestamp": "2024-10-22T10:15:00Z"
    }
  ]
}
```

### GET /api/conversations/{id}
```typescript
// Response:
{
  "id": "content_042",
  "title": "Redis Enterprise: DGX Spark + ThunderBlade Stack",
  "text": "# Full markdown content...",
  "category": "DGX Spark",
  "timestamp": "2024-10-20T14:30:00Z",
  "tags": ["redis", "dgx", "infrastructure"]
}
```

### GET /api/graph
```typescript
// Response: Graph data for D3.js visualization
{
  "nodes": [
    {"id": "content_001", "title": "...", "category": "...", "size": 1200}
  ],
  "edges": [
    {"source": "content_001", "target": "content_042", "strength": 0.8}
  ]
}
```

### GET /api/stats
```typescript
// Response:
{
  "totalConversations": 560,
  "totalCategories": 25,
  "topCategories": [
    {"name": "Ring & Cognates", "count": 109},
    {"name": "Integration", "count": 84}
  ],
  "timeline": [
    {"month": "2024-05", "count": 45},
    {"month": "2024-06", "count": 67}
  ]
}
```

## Implementation Timeline

### Phase 1: Backend API (2 hours)
1. Create Express server in `repos/hippocamp/console/server/`
2. Reuse Neo4j/Redis connections from MCP server
3. Implement 6 API endpoints
4. Add CORS for local development
5. Test with curl/Postman

### Phase 2: Frontend Scaffolding (1 hour)
1. Create React app with Vite: `repos/hippocamp/console/web/`
2. Setup Tailwind CSS v4
3. Configure TypeScript
4. Create component structure
5. Setup routing (React Router)

### Phase 3: Core Components (2 hours)
1. SearchBar with fuzzy search
2. CategoryBrowser with tree view
3. ConversationReader with markdown
4. StatsDashboard with metrics

### Phase 4: Memory Map Visualization (1.5 hours)
1. D3.js force-directed graph
2. Node click handlers
3. Zoom/pan controls
4. Category color coding

### Phase 5: Polish & Deploy (30 minutes)
1. Responsive design tweaks
2. Loading states
3. Error handling
4. Build for production
5. Deploy to localhost:3000

## File Structure

```
repos/hippocamp/
├── server/              # Existing MCP server
│   ├── src/
│   │   ├── index.ts     # MCP server
│   │   ├── neo4j-store.ts
│   │   └── redis-cache.ts
│   └── build/
├── console/             # NEW: Console web app
│   ├── server/          # Express API server
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── search.ts
│   │   │   │   ├── categories.ts
│   │   │   │   ├── conversations.ts
│   │   │   │   ├── graph.ts
│   │   │   │   └── stats.ts
│   │   │   └── stores/  # Reuse Neo4j/Redis from ../server/src
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/             # React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── MemoryMap.tsx
│       │   │   ├── SearchBar.tsx
│       │   │   ├── CategoryBrowser.tsx
│       │   │   ├── ConversationReader.tsx
│       │   │   └── StatsDashboard.tsx
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── package.json
│       ├── vite.config.ts
│       └── tailwind.config.ts
└── docs/
    ├── ARCHITECTURE.md
    ├── SETUP.md
    └── CONSOLE_PLAN.md  # This file
```

## Development Workflow

```bash
# Terminal 1: MCP Server (background)
cd repos/hippocamp/server
npm start

# Terminal 2: Console API Server
cd repos/hippocamp/console/server
npm run dev

# Terminal 3: React Frontend
cd repos/hippocamp/console/web
npm run dev

# Access at: http://localhost:3000
```

## Future Enhancements

### Phase 2 Features (Post-MVP)
1. **Natural Language Query API**
   - LLM-powered query understanding
   - "Show me all DGX conversations from October"
   - "What did I learn about Redis on Flash?"

2. **CLI Tool**
   - `hippo search "redis"`
   - `hippo cat content_042`
   - `hippo stats`

3. **Multi-Agent Access**
   - Share memory across multiple Claude instances
   - Agent-specific memory filters
   - Collaborative knowledge building

4. **Memory Tagging & Annotation**
   - User-added tags
   - Importance ratings
   - Custom metadata

5. **Export & Backup**
   - Full database export
   - Incremental backups
   - Markdown archive generation

## Success Metrics

After implementation, Hippocamp Console should provide:

✅ **Sub-second search** - <200ms for full-text queries
✅ **Intuitive navigation** - 3 clicks to any conversation
✅ **Visual discovery** - Graph reveals unexpected connections
✅ **Complete context** - Full markdown rendering with metadata
✅ **Persistent value** - Daily use for research and decision-making

## Next Steps

1. Create `repos/hippocamp/console/` directory structure
2. Initialize npm projects (server + web)
3. Implement API endpoints (reusing Neo4j/Redis from MCP server)
4. Build React components
5. D3.js visualization
6. Polish and deploy locally

---

**Ready to build!** This console transforms Hippocamp from a backend memory store into an interactive knowledge exploration tool.
