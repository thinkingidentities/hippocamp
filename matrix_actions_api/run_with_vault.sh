#!/bin/bash
# Wrapper script to run Matrix Actions API with 1Password vault credentials
# Usage: ./run_with_vault.sh [--dev]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TW_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if 1Password CLI is available
if ! command -v op &> /dev/null; then
    log_error "1Password CLI (op) is not installed or not in PATH"
    log_info "Install from: https://developer.1password.com/docs/cli/get-started/"
    exit 1
fi

# Check if signed in to 1Password
if ! op vault list &> /dev/null; then
    log_error "Not signed in to 1Password. Please run: op signin"
    exit 1
fi

log_info "Loading Matrix credentials from 1Password vault..."

# Use Python to load credentials via TWVault
CREDS_JSON=$("$TW_ROOT/.venv/bin/python" << 'EOF'
import sys
import json
sys.path.insert(0, "/Volumes/Projects/tw")
from infra.secrets import TWVault

try:
    vault = TWVault()

    # Load Matrix credentials
    matrix_creds = vault.get_matrix_credentials("gabe")

    # Load room ID for Gabe's Clearing
    try:
        room_id = vault.get_matrix_room_id("gabes-clearing")
    except Exception:
        room_id = None

    # Output as JSON
    print(json.dumps({
        "homeserver": matrix_creds.get("homeserver"),
        "user_id": matrix_creds.get("user_id"),
        "password": matrix_creds.get("password"),
        "device_id": matrix_creds.get("device_id"),
        "device_name": matrix_creds.get("device_name"),
        "room_id": room_id
    }))
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
EOF
)

if [ $? -ne 0 ]; then
    log_error "Failed to load credentials from 1Password"
    log_info "Make sure you have created the Matrix secrets:"
    log_info "  1. Run: cd $TW_ROOT && .venv/bin/python"
    log_info "  2. >>> from infra.secrets import TWVault"
    log_info "  3. >>> vault = TWVault()"
    log_info "  4. >>> vault.set_matrix_credentials('gabe', 'https://matrix.hippocamp.ai', '@gabe:ep2.local', 'password')"
    log_info "  5. >>> vault.set_matrix_room_id('gabes-clearing', '!roomid:ep2.local')"
    exit 1
fi

# Parse JSON and export environment variables
export MATRIX_HOMESERVER=$(echo "$CREDS_JSON" | "$TW_ROOT/.venv/bin/python" -c "import sys, json; print(json.load(sys.stdin)['homeserver'])")
export MATRIX_USER_ID=$(echo "$CREDS_JSON" | "$TW_ROOT/.venv/bin/python" -c "import sys, json; print(json.load(sys.stdin)['user_id'])")
export MATRIX_PASSWORD=$(echo "$CREDS_JSON" | "$TW_ROOT/.venv/bin/python" -c "import sys, json; print(json.load(sys.stdin)['password'])")
export MATRIX_DEVICE_ID=$(echo "$CREDS_JSON" | "$TW_ROOT/.venv/bin/python" -c "import sys, json; print(json.load(sys.stdin)['device_id'] or 'GABE_ACTIONS_DEVICE')")
export MATRIX_DEVICE_NAME=$(echo "$CREDS_JSON" | "$TW_ROOT/.venv/bin/python" -c "import sys, json; print(json.load(sys.stdin)['device_name'] or 'Gabe Matrix Actions Bridge')")

ROOM_ID=$(echo "$CREDS_JSON" | "$TW_ROOT/.venv/bin/python" -c "import sys, json; r = json.load(sys.stdin)['room_id']; print(r if r else '')")

log_info "Credentials loaded successfully"
log_info "  Homeserver: $MATRIX_HOMESERVER"
log_info "  User ID: $MATRIX_USER_ID"
log_info "  Device ID: $MATRIX_DEVICE_ID"
if [ -n "$ROOM_ID" ]; then
    log_info "  Gabe's Clearing Room ID: $ROOM_ID"
else
    log_warn "  Gabe's Clearing Room ID not configured in vault"
fi

# Set default environment variables
export PORT="${PORT:-8080}"
export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-https://chat.openai.com}"
export MATRIX_SESSION_STORE="${MATRIX_SESSION_STORE:-$SCRIPT_DIR/.matrix-store}"

# Ensure virtual environment exists
if [ ! -d "$SCRIPT_DIR/.venv" ]; then
    log_info "Creating virtual environment..."
    python3 -m venv "$SCRIPT_DIR/.venv"
    log_info "Installing dependencies..."
    "$SCRIPT_DIR/.venv/bin/pip" install --upgrade pip
    "$SCRIPT_DIR/.venv/bin/pip" install -r "$SCRIPT_DIR/requirements.txt"
fi

# Check if running in dev mode
DEV_MODE=0
if [ "${1:-}" = "--dev" ]; then
    DEV_MODE=1
    shift
fi

# Run the server
log_info "Starting Matrix Actions API on port $PORT..."
log_info "CORS allowed origins: $ALLOWED_ORIGINS"

if [ $DEV_MODE -eq 1 ]; then
    log_info "Running in development mode (auto-reload enabled)"
    exec "$SCRIPT_DIR/.venv/bin/uvicorn" main:app \
        --host 0.0.0.0 \
        --port "$PORT" \
        --reload \
        --app-dir "$SCRIPT_DIR"
else
    log_info "Running in production mode"
    exec "$SCRIPT_DIR/.venv/bin/uvicorn" main:app \
        --host 0.0.0.0 \
        --port "$PORT" \
        --app-dir "$SCRIPT_DIR"
fi
