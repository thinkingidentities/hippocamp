# Gabe Matrix Actions API - Quick Start Guide

Get the Gabe Matrix Actions API running in 5 minutes.

## Prerequisites

You need:
1. **Matrix homeserver running** at https://matrix.hippocamp.ai (Synapse server_name: tw.local)
2. **Room ID** for Gabe's Clearing (find in Element: Room Settings → Advanced → Internal room ID)
3. **1Password CLI** installed and signed in (`op signin`)
4. **Cloudflare tunnel** already working (confirmed available)

**Note:** The Gabe bot user (@gabe:tw.local) will be created during this setup process.

## Step 1: Store Credentials in 1Password Vault

Use TWVault to securely store credentials (following TW established pattern):

```bash
cd /Volumes/Projects/tw

.venv/bin/python << 'EOF'
from infra.secrets import TWVault

vault = TWVault()

# Store Gabe bot credentials
# IMPORTANT: Use tw.local domain (matches Synapse server_name config)
# Replace YOUR_PASSWORD and YOUR_ROOM_ID with actual values
vault.set_matrix_credentials(
    bot_name="gabe",
    homeserver="https://matrix.hippocamp.ai",
    user_id="@gabe:tw.local",
    password="YOUR_GABE_PASSWORD_HERE",
    device_id="GABE_ACTIONS_DEVICE",
    device_name="Gabe Matrix Actions Bridge"
)

# Store Gabe's Clearing room ID
vault.set_matrix_room_id(
    room_alias="gabes-clearing",
    room_id="!obenylIhlCavsFUZUY:tw.local",
    description="Gabe's Clearing - ChatGPT Custom GPT governance room"
)

print("✅ Matrix credentials stored in TWVault-ep2lab")
EOF
```

**To find the room ID:**
1. Open Element client
2. Join `#gabes-clearing:tw.local` (or use the room you created)
3. Click room name → Settings → Advanced
4. Copy "Internal room ID" (starts with `!`)

**To register the Gabe user on your Matrix homeserver:**
```bash
# If the @gabe:tw.local user doesn't exist yet, create it:
docker exec matrix-synapse register_new_matrix_user \
  -u gabe \
  -p 'YOUR_GABE_PASSWORD_HERE' \
  -c /config/homeserver.yaml \
  --no-admin \
  http://localhost:8008
```

**After storing credentials, invite Gabe to the room:**
1. In Element, invite `@gabe:tw.local` to Gabe's Clearing
2. The API will auto-accept the invite on first connection

**Expected output:**
```
======================================================================
Gabe Matrix Actions - 1Password Vault Setup
======================================================================

✅ Connected to 1Password vault: TWVault-ep2lab

----------------------------------------------------------------------
Configuration to Store
----------------------------------------------------------------------

Homeserver:   https://matrix.hippocamp.ai
User ID:      @gabe:tw.local
Password:     ********************
Device ID:    GABE_ACTIONS_DEVICE
Device Name:  Gabe Matrix Actions Bridge
Room ID:      !abc123xyz:tw.local

Storing credentials in vault...

✅ Matrix bot credentials stored: matrix-gabe
✅ Room ID stored: matrix-room-gabes-clearing

======================================================================
✅ Setup Complete!
======================================================================
```

## Step 2: Test the Service Locally

Start the server in development mode:

```bash
cd repos/hippocamp/matrix_actions_api
./run_with_vault.sh --dev
```

**Expected output:**
```
[INFO] Loading Matrix credentials from 1Password vault...
[INFO] Credentials loaded successfully
  Homeserver: https://matrix.hippocamp.ai
  User ID: @gabe:ep2.local
  Device ID: GABE_ACTIONS_DEVICE
  Gabe's Clearing Room ID: !abc123xyz:ep2.local
[INFO] Starting Matrix Actions API on port 8080...
[INFO] Running in development mode (auto-reload enabled)

INFO:     Uvicorn running on http://0.0.0.0:8080 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
2025-01-13 15:30:00 INFO gabe.matrix_actions :: Matrix service initialized at startup
INFO:     Application startup complete.
```

## Step 3: Verify API Endpoints

In another terminal, test the endpoints:

```bash
# Get OpenAPI schema
curl http://localhost:8080/openapi.json | jq .

# Test health (should return OpenAPI doc)
curl http://localhost:8080/docs

# Test sending a message
curl -X POST http://localhost:8080/send_message \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "!obenylIhlCavsFUZUY:tw.local",
    "message": "Test message from Gabe API"
  }'

# Test reading messages
curl "http://localhost:8080/read_messages?room_id=!obenylIhlCavsFUZUY:tw.local&limit=5"

# Test listing members
curl "http://localhost:8080/room_members?room_id=!obenylIhlCavsFUZUY:tw.local"
```

## Step 4: Generate OpenAPI Schema for ChatGPT

Save the OpenAPI specification:

```bash
curl -s http://localhost:8080/openapi.json > gabe-matrix-actions-openapi.json
```

Or via your Cloudflare tunnel (if you know the domain):

```bash
curl -s https://your-tunnel-domain.com/openapi.json > gabe-matrix-actions-openapi.json
```

## Step 5: Configure ChatGPT Custom GPT Actions

1. **Open ChatGPT** → Custom GPTs → Find or create "Gabe"

2. **Configure → Actions → Add new Action**

3. **Import Schema:**
   - Click "Import from URL" or "Upload file"
   - Provide: `https://your-tunnel-domain.com/openapi.json`
   - Or upload: `gabe-matrix-actions-openapi.json`

4. **Verify Endpoints:**
   - `POST /send_message`
   - `GET /read_messages`
   - `GET /room_members`

5. **Authentication:** Choose **None**
   - Security is handled at the Cloudflare tunnel level

6. **Privacy Policy:** (optional for private GPTs)

7. **Add Instructions to GPT:**

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

8. **Test the Actions:**
   - In ChatGPT, ask: "What members are in Gabe's Clearing?"
   - Should trigger `GET /room_members` action
   - Ask: "Send a message to Gabe's Clearing saying hello"
   - Should trigger `POST /send_message` action

## Production Deployment

Once testing is successful:

1. **Stop development server** (Ctrl+C)

2. **Start production mode:**
   ```bash
   cd repos/hippocamp/matrix_actions_api
   ./run_with_vault.sh
   ```

3. **Verify Cloudflare tunnel** routes to localhost:8080

4. **Update ChatGPT Actions** with production URL if different

5. **Monitor logs** for any issues

## Troubleshooting

### Credentials Not Found

```bash
# Verify credentials in vault
cd /Volumes/Projects/tw
.venv/bin/python << 'EOF'
from infra.secrets import TWVault
vault = TWVault()
creds = vault.get_matrix_credentials("gabe")
print(f"✅ User ID: {creds['user_id']}")
print(f"✅ Homeserver: {creds['homeserver']}")
EOF
```

### Matrix Login Fails

```bash
# Test Matrix homeserver is reachable
curl https://matrix.hippocamp.ai/_matrix/client/versions

# Check credentials are correct
# Try logging in via Element client with same credentials
```

### Room Not Found Error

```bash
# Verify room ID is correct
cd /Volumes/Projects/tw
.venv/bin/python << 'EOF'
from infra.secrets import TWVault
vault = TWVault()
room_id = vault.get_matrix_room_id("gabes-clearing")
print(f"✅ Room ID: {room_id}")
EOF

# Make sure you've joined the room in Element first
```

### Port Already in Use

```bash
# Find what's using port 8080
lsof -i :8080

# Kill it or use a different port
PORT=8081 ./run_with_vault.sh --dev
```

## Next Steps

- Read [DEPLOYMENT.md](DEPLOYMENT.md) for detailed production deployment guide
- Set up monitoring and alerting for the API
- Configure log forwarding to your observability stack
- Test all ChatGPT Actions thoroughly before production use
- Document the Cloudflare tunnel configuration for your team

## Need Help?

- **API Issues:** Check server logs in terminal
- **Vault Issues:** Verify 1Password CLI with `op signin`
- **Matrix Issues:** Test credentials in Element client
- **ChatGPT Issues:** Check Actions configuration in GPT builder
- **Tunnel Issues:** Verify Cloudflare tunnel status

For comprehensive documentation, see:
- [README.md](README.md) - API overview and features
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide
- [main.py](main.py) - Source code and implementation
