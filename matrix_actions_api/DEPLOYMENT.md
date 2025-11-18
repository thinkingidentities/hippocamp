# Gabe Matrix Actions API - Deployment Guide

FastAPI server exposing ChatGPT Custom GPT Actions for Gabe's Clearing Matrix room.

## Overview

This service provides a production-grade HTTPS bridge that allows the **Gabe** Custom GPT to interact with the **Gabe's Clearing** Matrix room through a tightly governed FastAPI surface. The implementation follows the "act only when asked" principle - no autonomous loops or background polling.

## Architecture

```
ChatGPT Custom GPT (Gabe)
    ↓ HTTPS (Custom GPT Actions)
Cloudflare Tunnel (gabe-actions.carbon.example.com)
    ↓ localhost:8080
Matrix Actions API (FastAPI)
    ↓ matrix-nio client
Matrix Homeserver (matrix.hippocamp.ai)
    ↓ E2EE room
Gabe's Clearing (#gabes-clearing:ep2.local)
```

## Prerequisites

### Required Infrastructure

1. **Matrix Homeserver**: `matrix.hippocamp.ai` (already deployed)
2. **Cloudflare Tunnel**: Working tunnel to expose localhost:8080 (confirmed available)
3. **1Password Vault**: `TWVault-ep2lab` with Matrix credentials
4. **Python 3.11+**: For running the FastAPI server

### Required Secrets

The following secrets must be stored in 1Password `TWVault-ep2lab` vault:

1. **matrix-gabe** - Gabe bot credentials
   - homeserver: `https://matrix.hippocamp.ai`
   - user_id: `@gabe:ep2.local`
   - password: Gabe's Matrix account password
   - device_id: `GABE_ACTIONS_DEVICE` (optional)
   - device_name: `Gabe Matrix Actions Bridge` (optional)

2. **matrix-room-gabes-clearing** - Room configuration
   - room_id: Matrix room ID (e.g., `!abcd1234:ep2.local`)
   - alias: `#gabes-clearing:ep2.local`

## Initial Setup

### Step 1: Configure 1Password Vault

Store the Matrix credentials in 1Password vault:

```bash
cd /Volumes/Projects/tw
.venv/bin/python << 'EOF'
from infra.secrets import TWVault

vault = TWVault()

# Store Gabe bot credentials
vault.set_matrix_credentials(
    bot_name="gabe",
    homeserver="https://matrix.hippocamp.ai",
    user_id="@gabe:ep2.local",
    password="YOUR_GABE_PASSWORD_HERE",
    device_id="GABE_ACTIONS_DEVICE",
    device_name="Gabe Matrix Actions Bridge"
)

# Store Gabe's Clearing room ID
# To find the room ID: Join the room in Element, go to Room Settings → Advanced
vault.set_matrix_room_id(
    room_alias="gabes-clearing",
    room_id="!YOUR_ROOM_ID_HERE:ep2.local",
    description="Gabe's Clearing - ChatGPT Custom GPT governance room"
)

print("✅ Matrix credentials stored in 1Password vault")
EOF
```

### Step 2: Verify 1Password CLI Access

```bash
# Check 1Password CLI is installed
op --version

# Sign in to 1Password (if not already signed in)
op signin

# Verify vault access
op vault get TWVault-ep2lab

# Test credential retrieval
cd /Volumes/Projects/tw
.venv/bin/python << 'EOF'
from infra.secrets import TWVault
vault = TWVault()
creds = vault.get_matrix_credentials("gabe")
print(f"✅ Loaded credentials for: {creds['user_id']}")
print(f"   Homeserver: {creds['homeserver']}")
EOF
```

### Step 3: Install Dependencies

```bash
cd /Volumes/Projects/tw/repos/hippocamp/matrix_actions_api

# Create virtual environment (if not already created)
python3 -m venv .venv

# Install dependencies
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
```

## Running the Service

### Development Mode (Local Testing)

For testing on localhost with auto-reload:

```bash
cd /Volumes/Projects/tw/repos/hippocamp/matrix_actions_api
./run_with_vault.sh --dev
```

The server will start on http://localhost:8080 with auto-reload enabled.

### Production Mode

For production deployment (served via Cloudflare Tunnel):

```bash
cd /Volumes/Projects/tw/repos/hippocamp/matrix_actions_api
./run_with_vault.sh
```

The `run_with_vault.sh` wrapper:
- Verifies 1Password CLI access
- Loads Matrix credentials from TWVault-ep2lab
- Sets environment variables securely
- Starts uvicorn with production settings

### Manual Start (Without Vault)

If you need to run without 1Password vault (not recommended for production):

```bash
cd /Volumes/Projects/tw/repos/hippocamp/matrix_actions_api

# Create .env file (copy from .env.example and fill in values)
cp .env.example .env
# Edit .env with real values (NEVER commit this file)

# Run directly
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8080
```

## API Endpoints

### POST /send_message

Send a text message to a Matrix room.

**Request:**
```json
{
  "room_id": "!abcd1234:ep2.local",
  "message": "Hello from Gabe!"
}
```

**Response:**
```json
{
  "event_id": "$event123456",
  "room_id": "!abcd1234:ep2.local",
  "status": "sent"
}
```

### GET /read_messages

Read recent messages from a Matrix room.

**Query Parameters:**
- `room_id` (required): Matrix room ID
- `limit` (optional): Number of messages to return (1-50, default: 20)

**Response:**
```json
[
  {
    "body": "Message text",
    "event_id": "$event123",
    "sender": "@user:ep2.local",
    "timestamp": 1705234567890
  }
]
```

### GET /room_members

List members of a Matrix room.

**Query Parameters:**
- `room_id` (required): Matrix room ID

**Response:**
```json
[
  {
    "user_id": "@gabe:ep2.local",
    "display_name": "Gabe"
  },
  {
    "user_id": "@code:ep2.local",
    "display_name": "Code"
  }
]
```

### GET /openapi.json

Returns the OpenAPI specification for ChatGPT Custom GPT Actions configuration.

## Cloudflare Tunnel Configuration

Since you confirmed the Cloudflare tunnel is already working, the service should be accessible at the tunnel's public URL once started.

### Verify Tunnel Status

```bash
# Check if tunnel is running
cloudflared tunnel list

# Test local endpoint
curl http://localhost:8080/openapi.json

# Test via Cloudflare tunnel (replace with your actual domain)
curl https://gabe-actions.carbon.example.com/openapi.json
```

### Tunnel Configuration Reference

If you need to verify or update the tunnel configuration, it should route traffic from the public domain to `localhost:8080`:

```yaml
# Example cloudflared config (usually in ~/.cloudflared/config.yml)
tunnel: YOUR_TUNNEL_ID
credentials-file: /path/to/credentials.json

ingress:
  - hostname: gabe-actions.carbon.example.com
    service: http://localhost:8080
  - service: http_status:404
```

## ChatGPT Custom GPT Configuration

### Step 1: Generate OpenAPI Schema

With the server running, fetch the OpenAPI specification:

```bash
curl -s http://localhost:8080/openapi.json > gabe-matrix-actions-openapi.json
```

Or via the public tunnel URL:

```bash
curl -s https://gabe-actions.carbon.example.com/openapi.json > gabe-matrix-actions-openapi.json
```

### Step 2: Configure Custom GPT Actions

1. Open ChatGPT and navigate to **Custom GPT Builder**
2. Select the **Gabe** Custom GPT (or create new)
3. Go to **Configure → Actions → Add new Action**
4. Upload `gabe-matrix-actions-openapi.json` or paste the public OpenAPI URL
5. Verify endpoints appear:
   - `POST /send_message`
   - `GET /read_messages`
   - `GET /room_members`

### Step 3: Authentication Settings

- **Authentication**: None (authentication handled at Cloudflare tunnel level)
- **Privacy**: Custom GPT already runs under carbon governance
- **Origin Restrictions**: Set `ALLOWED_ORIGINS=https://chat.openai.com` in production

### Step 4: Provide Room ID to GPT

Add instructions to the Custom GPT configuration:

```
When interacting with Gabe's Clearing Matrix room, use:
- room_id: !YOUR_ROOM_ID_HERE:ep2.local

Available actions:
- Send message: POST /send_message
- Read messages: GET /read_messages?room_id=...&limit=20
- List members: GET /room_members?room_id=...

Only act when explicitly asked by carbon (Jim). No autonomous messaging.
```

## Production Deployment Checklist

- [ ] Matrix credentials stored in 1Password TWVault-ep2lab
- [ ] Room ID for Gabe's Clearing stored in vault
- [ ] 1Password CLI installed and authenticated
- [ ] Dependencies installed in `.venv`
- [ ] `run_with_vault.sh` tested in development mode
- [ ] Cloudflare tunnel verified and running
- [ ] Service accessible via public URL
- [ ] OpenAPI schema generated from `/openapi.json`
- [ ] Custom GPT Actions configured with OpenAPI schema
- [ ] Room ID provided in Custom GPT instructions
- [ ] CORS origins restricted to `https://chat.openai.com`
- [ ] Logs forwarded to Carbon observability (optional)

## Operational Notes

### Session Persistence

The Matrix session is stored on disk at `MATRIX_SESSION_STORE` (default: `.matrix-store`). This directory must be persistent across deployments to preserve access tokens and avoid repeated logins.

**Important**: Ensure `.matrix-store` is included in backups but excluded from git:

```bash
# Already in .gitignore
echo ".matrix-store/" >> .gitignore
```

### Logging

Logs are emitted with logger name `gabe.matrix_actions`:

```python
# Example log messages
2025-01-13 14:30:00 INFO gabe.matrix_actions :: Matrix service initialized at startup
2025-01-13 14:30:15 INFO gabe.matrix_actions :: Sending message to room !abc:ep2.local
2025-01-13 14:30:16 INFO gabe.matrix_actions :: Message delivered: $event123
```

Forward logs to your Carbon observability stack for auditing.

### Monitoring

Monitor the following:
- HTTP request latency (FastAPI metrics)
- Matrix login failures (401 errors in logs)
- Room send failures (502 errors in logs)
- Matrix sync timeouts (5s timeout configured)
- Cloudflare tunnel connectivity

### Security

- **No autonomous operations**: Server only acts when endpoints are invoked via HTTPS
- **CORS protection**: Restrict `ALLOWED_ORIGINS` to `https://chat.openai.com`
- **Secret management**: Credentials never committed to git or exposed in logs
- **TLS encryption**: All traffic to Matrix homeserver uses HTTPS
- **E2EE rooms**: Gabe's Clearing uses E2EE for carbon governance

## Troubleshooting

### Credential Loading Fails

```bash
# Verify 1Password CLI access
op signin
op vault list

# Test credential retrieval
cd /Volumes/Projects/tw
.venv/bin/python -c "from infra.secrets import TWVault; print(TWVault().get_matrix_credentials('gabe'))"
```

### Matrix Login Fails

Check the Matrix credentials in 1Password:

```bash
# Verify homeserver is reachable
curl https://matrix.hippocamp.ai/_matrix/client/versions

# Test credentials manually
cd /Volumes/Projects/tw/repos/hippocamp/matrix_actions_api
.venv/bin/python << 'EOF'
import asyncio
from nio import AsyncClient

async def test_login():
    client = AsyncClient("https://matrix.hippocamp.ai", "@gabe:ep2.local")
    response = await client.login("YOUR_PASSWORD_HERE")
    print(response)
    await client.close()

asyncio.run(test_login())
EOF
```

### Room Not Found

Verify the room ID is correct:

```bash
# In Element client:
# 1. Join #gabes-clearing:ep2.local
# 2. Go to Room Settings → Advanced
# 3. Copy "Internal room ID"

# Store in vault
cd /Volumes/Projects/tw
.venv/bin/python << 'EOF'
from infra.secrets import TWVault
vault = TWVault()
vault.set_matrix_room_id("gabes-clearing", "!CORRECT_ROOM_ID:ep2.local")
EOF
```

### CORS Errors from ChatGPT

Update `ALLOWED_ORIGINS` environment variable:

```bash
# In run_with_vault.sh or .env
export ALLOWED_ORIGINS=https://chat.openai.com
```

Restart the service after changing CORS settings.

## Maintenance

### Updating Dependencies

```bash
cd /Volumes/Projects/tw/repos/hippocamp/matrix_actions_api
.venv/bin/pip install --upgrade fastapi uvicorn matrix-nio
.venv/bin/pip freeze > requirements.txt
```

### Rotating Matrix Password

```bash
# Update password in 1Password vault
cd /Volumes/Projects/tw
.venv/bin/python << 'EOF'
from infra.secrets import TWVault
vault = TWVault()
vault.set_matrix_credentials(
    bot_name="gabe",
    homeserver="https://matrix.hippocamp.ai",
    user_id="@gabe:ep2.local",
    password="NEW_PASSWORD_HERE",
    device_id="GABE_ACTIONS_DEVICE",
    device_name="Gabe Matrix Actions Bridge"
)
EOF

# Restart the service
./run_with_vault.sh
```

### Clearing Session Store

If Matrix authentication gets into a bad state:

```bash
cd /Volumes/Projects/tw/repos/hippocamp/matrix_actions_api
rm -rf .matrix-store
# Service will re-authenticate on next start
./run_with_vault.sh
```

## References

- [Matrix Actions API README](README.md) - Operator quick reference
- [FastAPI Documentation](https://fastapi.tiangolo.com/) - API framework
- [matrix-nio Documentation](https://matrix-nio.readthedocs.io/) - Matrix client library
- [1Password CLI](https://developer.1password.com/docs/cli/) - Secrets management
- [ChatGPT Actions](https://platform.openai.com/docs/actions) - Custom GPT integration
- [TW Infrastructure Docs](../../../docs/) - Lab architecture and naming conventions
