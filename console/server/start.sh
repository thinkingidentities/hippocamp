#!/bin/bash
# Start Hippocamp Console API server with credentials from TWVault

cd "$(dirname "$0")"

# Get credentials from 1Password vault
export NEO4J_URI="bolt://localhost:7688"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD=$(cd /Volumes/Projects/tw && .venv/bin/python -c "from infra.secrets import TWVault; v=TWVault(); print(v.get_nessie_neo4j_credentials()['password'])")
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export PORT="3001"

echo "Starting Hippocamp Console API server..."
npm run dev
