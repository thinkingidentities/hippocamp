# Gabe Matrix Actions API

FastAPI server that exposes a minimal, carbon-governed HTTPS interface for ChatGPT Custom GPT Actions to send and receive messages from the Matrix room **Gabe's Clearing**.

## Features
- `POST /send_message` – send a text event to a Matrix room on demand
- `GET /read_messages` – fetch the latest text events when explicitly requested
- `GET /room_members` – list the currently joined members for auditing
- matrix-nio client with session storage on disk and optional 1Password-backed secrets
- structured logging for every operator-triggered action

## Prerequisites
1. Python 3.13+
2. Access to the Matrix homeserver `https://matrix.hippocamp.ai` (Synapse server_name: tw.local)
3. Credentials for the Gabe bot account (@gabe:tw.local)
4. [1Password CLI](https://developer.1password.com/docs/cli/) for secure credential management (required)

## Quick Start (Recommended)

The fastest way to get started with production credentials from 1Password:

```bash
cd repos/hippocamp/matrix_actions_api
./run_with_vault.sh --dev  # Development mode with auto-reload
```

The wrapper script automatically:
- Loads Matrix credentials from 1Password TWVault-ep2lab vault
- Verifies 1Password CLI access
- Sets up environment variables securely
- Starts uvicorn with appropriate settings

For detailed setup instructions, see [QUICKSTART.md](QUICKSTART.md).

## Configuration

**Room Information:**
- Room ID: `!obenylIhlCavsFUZUY:tw.local`
- Room Alias: `#gabes-clearing:tw.local`
- Members: @code:tw.local, @jim:tw.local, @gabe:tw.local

**Credentials Storage:**
All credentials are stored in 1Password vault `TWVault-ep2lab`:
- Secret: `matrix-gabe` (homeserver, user_id, password, device_id, device_name)
- Secret: `matrix-room-gabes-clearing` (room_id, alias)

## Running the Server

**With 1Password vault (recommended):**
```bash
./run_with_vault.sh --dev  # Development mode with auto-reload
./run_with_vault.sh        # Production mode
```

**Manual mode (for testing only):**
```bash
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
```

The server performs no background work. All Matrix calls happen only when `/send_message`, `/read_messages`, or `/room_members` are invoked over HTTPS.

## Generating the OpenAPI Schema for ChatGPT Actions

The OpenAPI schema is always available at `/openapi.json` when the server is running.

```bash
# Save schema locally
curl -s http://localhost:8080/openapi.json > gabe-matrix-actions-openapi.json

# Or via Cloudflare tunnel (if configured)
curl -s https://your-tunnel-domain.com/openapi.json > gabe-matrix-actions-openapi.json
```

The schema defines three endpoints for ChatGPT Custom GPT Actions:
- `POST /send_message` - Send a message to Gabe's Clearing
- `GET /read_messages` - Read recent messages from the room
- `GET /room_members` - List current room members

## Configuring ChatGPT Custom GPT Actions

1. **Expose the API via Cloudflare tunnel** (or other HTTPS ingress)
   - The Cloudflare tunnel should already be configured and working
   - Point it to `http://localhost:8080`

2. **In ChatGPT Custom GPT builder:**
   - Open **Actions → Add new Action**
   - Import schema from URL or upload `gabe-matrix-actions-openapi.json`
   - Verify endpoints:
     - `POST /send_message`
     - `GET /read_messages`
     - `GET /room_members`

3. **Authentication:** Choose **None**
   - Security is handled at the Cloudflare tunnel level
   - Custom GPT runs under carbon governance

4. **Add instructions to the GPT:**
   ```markdown
   You have access to Gabe's Clearing Matrix room via these actions:

   Configuration:
   - Room ID: !obenylIhlCavsFUZUY:tw.local
   - Room Alias: #gabes-clearing:tw.local

   Available Actions:
   1. POST /send_message - Send a message to Gabe's Clearing
   2. GET /read_messages - Read recent messages from Gabe's Clearing
   3. GET /room_members - List current members of Gabe's Clearing

   Important Rules:
   - ONLY act when explicitly asked by carbon (Jim)
   - NO autonomous messaging or polling
   - Always use the room_id provided above
   - Log all actions taken for audit trail
   ```

For complete setup instructions, see [QUICKSTART.md](QUICKSTART.md).

## API Endpoints

### POST /send_message
Send a text message to a Matrix room.

**Request body:**
```json
{
  "room_id": "!obenylIhlCavsFUZUY:tw.local",
  "message": "Your message here"
}
```

### GET /read_messages
Read recent messages from a Matrix room.

**Query parameters:**
- `room_id` (required): The Matrix room ID
- `limit` (optional): Number of messages to retrieve (default: 10)

### GET /room_members
List members of a Matrix room.

**Query parameters:**
- `room_id` (required): The Matrix room ID

## Operational Notes

- **Logging:** All actions are logged with logger name `gabe.matrix_actions`
- **Session persistence:** Matrix session tokens are stored in `.matrix-store/` directory
- **No background work:** Server only acts when explicitly called via API endpoints
- **No autonomy:** Satisfies carbon governance requirement for explicit operator control

## Testing

See [QUICKSTART.md](QUICKSTART.md) for detailed testing instructions with curl examples.

## Technical Details

- **Python version:** 3.13+
- **Matrix library:** matrix-nio 0.25.2 (Python 3.13 compatible)
- **Web framework:** FastAPI 0.111.0
- **Server:** uvicorn with ASGI support
- **Credentials:** 1Password vault integration via TWVault
- **Session storage:** Encrypted on-disk storage via matrix-nio
