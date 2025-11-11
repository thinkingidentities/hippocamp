# Hippocamp 🦛

**The hippocampus for AI agents** - Where silicon makes memories.

Hippocamp provides persistent episodic and semantic memory for AI agents through a graph-based knowledge layer accessible via the Model Context Protocol (MCP).

## Overview

Just as the hippocampus enables memory formation in biological brains, Hippocamp enables AI agents to:
- **Remember** conversations and knowledge across sessions
- **Connect** related information through graph relationships
- **Retrieve** relevant context through semantic search
- **Share** knowledge across multiple agents (memory commons)

## Architecture

```
Nessie (or other sources)
    ↓ [sync]
Neo4j Graph + Redis Cache
    ↓ [MCP protocol]
Hippocamp MCP Server
    ↓ [stdio transport]
Claude Desktop / Code / API
```

### Components

- **`server/`** - MCP server implementation (Node.js/TypeScript)
- **`sync/`** - Data extraction and sync pipelines (Python)
- **`graph/`** - Neo4j schema and queries
- **`cache/`** - Redis caching layer
- **`docs/`** - Architecture and usage documentation

## Quick Start

### 1. Prerequisites

- Neo4j 5.x running on `bolt://localhost:7688`
- Redis running on `localhost:6379`
- Node.js 18+
- Python 3.13+

### 2. Extract and Sync Data

```bash
# Extract from Nessie SQLite database
python3 scripts/extract_nessie_sqlite.py

# Sync to Neo4j and Redis
python3 scripts/run_nessie_sync.py
```

### 3. Start Hippocamp MCP Server

```bash
cd repos/hippocamp/server
npm install
npm run build
npm start
```

### 4. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hippocamp": {
      "command": "node",
      "args": ["/Volumes/Projects/tw/repos/hippocamp/server/build/index.js"]
    }
  }
}
```

## MCP Tools

### `search_memory`
Search across all memories using full-text and semantic search.

```typescript
// Example usage in Claude
search_memory({
  query: "DGX Redis setup",
  limit: 10
})
```

### `get_by_category`
Retrieve all memories in a specific category/folder.

```typescript
get_by_category({
  category: "EP2",
  limit: 20
})
```

### `get_conversation`
Retrieve a specific conversation by ID.

```typescript
get_conversation({
  id: "content_042"
})
```

### `get_categories`
List all available categories/folders.

```typescript
get_categories()
```

## Data Sources

Currently supports:
- **Nessie** - Direct SQLite database extraction (560+ ChatGPT conversation exports)
- **Custom ingestion** - Extensible pipeline for any structured data source

## Vision: Memory Commons

Hippocamp is designed to evolve from:
1. **Local memory** - Single agent's persistent memory
2. **Shared memory** - Multiple agents accessing common knowledge base
3. **Memory commons** - Distributed knowledge network for aligned AI agents

This enables:
- Context continuity across sessions
- Collaborative agent workflows
- Verified knowledge provenance
- Trust through transparent memory

## Technology Stack

- **Neo4j** - Graph database for semantic relationships
- **Redis** - Fast cache for category trees and frequent queries
- **MCP** - Model Context Protocol for Claude integration
- **TypeScript** - Type-safe server implementation
- **Python** - Data extraction and sync pipelines

## Project Status

**Current**: Phase 1 - Local MCP server with Neo4j/Redis backend
**Next**: Phase 2 - Multi-agent memory sharing
**Future**: Phase 3 - Distributed memory commons

## Related Projects

- **EP2** - Enterprise Platform 2 for aligned AI agents
- **Nessie** - Knowledge management app (data source)
- **Mem0** - Episodic memory layer
- **Agno** - Agentic workflow orchestration

## License

MIT

## Contributing

Hippocamp is part of the TrustedWork/ThinkingIdentities platform. Contributions welcome as the project evolves toward open-source release.

---

*"Where silicon remembers"* 🦛
