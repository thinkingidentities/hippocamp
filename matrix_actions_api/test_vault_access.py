#!/usr/bin/env python3
"""
Quick test to verify 1Password vault access and credential retrieval.

Usage:
    python test_vault_access.py
"""

import sys
from pathlib import Path

# Add TW root to path for imports
TW_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(TW_ROOT))

print("=" * 70)
print("Testing 1Password Vault Access")
print("=" * 70)
print()

# Test 1: Import TWVault
print("Test 1: Importing TWVault...")
try:
    from infra.secrets import TWVault, VaultException
    print("✅ Successfully imported TWVault")
except ImportError as e:
    print(f"❌ Failed to import TWVault: {e}")
    sys.exit(1)

print()

# Test 2: Initialize vault connection
print("Test 2: Connecting to 1Password vault...")
try:
    vault = TWVault()
    print("✅ Successfully connected to TWVault-ep2lab")
except VaultException as e:
    print(f"❌ Failed to connect to vault: {e}")
    print()
    print("Make sure:")
    print("  1. 1Password CLI is installed: brew install --cask 1password-cli")
    print("  2. You're signed in: op signin")
    sys.exit(1)

print()

# Test 3: Retrieve Matrix credentials
print("Test 3: Retrieving Matrix credentials for Gabe...")
try:
    creds = vault.get_matrix_credentials("gabe")
    print("✅ Successfully retrieved Matrix credentials")
    print()
    print("  Homeserver:  ", creds.get('homeserver', 'NOT SET'))
    print("  User ID:     ", creds.get('user_id', 'NOT SET'))
    print("  Password:    ", '***' if creds.get('password') else 'NOT SET')
    print("  Device ID:   ", creds.get('device_id', 'NOT SET'))
    print("  Device Name: ", creds.get('device_name', 'NOT SET'))

    # Verify required fields
    if not creds.get('homeserver'):
        print()
        print("⚠️  WARNING: homeserver not set")
    if not creds.get('user_id'):
        print()
        print("⚠️  WARNING: user_id not set")
    if not creds.get('password'):
        print()
        print("⚠️  WARNING: password not set")

except Exception as e:
    print(f"❌ Failed to retrieve Matrix credentials: {e}")
    print()
    print("Run this to create the credentials:")
    print("  cd /Volumes/Projects/tw")
    print("  .venv/bin/python repos/hippocamp/matrix_actions_api/store_credentials.py \\")
    print("    --password 'YOUR_PASSWORD'")
    sys.exit(1)

print()

# Test 4: Retrieve room ID
print("Test 4: Retrieving Gabe's Clearing room ID...")
try:
    room_id = vault.get_matrix_room_id("gabes-clearing")
    print("✅ Successfully retrieved room ID")
    print()
    print("  Room ID:     ", room_id)
except Exception as e:
    print(f"⚠️  Room ID not configured: {e}")
    print()
    print("This is optional but recommended. To add it:")
    print("  cd /Volumes/Projects/tw")
    print("  .venv/bin/python repos/hippocamp/matrix_actions_api/store_credentials.py \\")
    print("    --password 'YOUR_PASSWORD' \\")
    print("    --room-id '!YOUR_ROOM_ID:ep2.local'")

print()
print("=" * 70)
print("✅ Vault Access Test Complete")
print("=" * 70)
print()
print("You're ready to run the Matrix Actions API!")
print()
print("Next step:")
print("  cd repos/hippocamp/matrix_actions_api")
print("  ./run_with_vault.sh --dev")
print()
