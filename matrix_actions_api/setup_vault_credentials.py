#!/usr/bin/env python3
"""
Setup script for storing Gabe Matrix Actions credentials in 1Password vault.

Usage:
    python setup_vault_credentials.py

This script will prompt for the required credentials and store them in
the TWVault-ep2lab 1Password vault.
"""

import sys
from pathlib import Path
from getpass import getpass

# Add TW root to path for imports
TW_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(TW_ROOT))

try:
    from infra.secrets import TWVault, VaultException
except ImportError as e:
    print(f"ERROR: Failed to import TWVault: {e}")
    print(f"Make sure you're running this from the TW workspace root.")
    print(f"Expected TW root: {TW_ROOT}")
    sys.exit(1)


def main():
    print("=" * 70)
    print("Gabe Matrix Actions - 1Password Vault Setup")
    print("=" * 70)
    print()
    print("This script will store the Matrix credentials for Gabe bot in")
    print("1Password vault: TWVault-ep2lab")
    print()

    # Initialize vault
    try:
        vault = TWVault()
        print("✅ Connected to 1Password vault: TWVault-ep2lab")
    except VaultException as e:
        print(f"❌ Failed to connect to 1Password vault: {e}")
        print()
        print("Make sure:")
        print("  1. 1Password CLI is installed: brew install --cask 1password-cli")
        print("  2. You're signed in: op signin")
        print("  3. You have access to TWVault-ep2lab vault")
        sys.exit(1)

    print()
    print("-" * 70)
    print("Matrix Bot Credentials")
    print("-" * 70)
    print()

    # Prompt for Matrix credentials
    homeserver = input("Matrix homeserver URL [https://matrix.hippocamp.ai]: ").strip()
    if not homeserver:
        homeserver = "https://matrix.hippocamp.ai"

    user_id = input("Matrix user ID [@gabe:ep2.local]: ").strip()
    if not user_id:
        user_id = "@gabe:ep2.local"

    password = getpass("Matrix password: ").strip()
    if not password:
        print("❌ Password cannot be empty")
        sys.exit(1)

    device_id = input("Device ID [GABE_ACTIONS_DEVICE]: ").strip()
    if not device_id:
        device_id = "GABE_ACTIONS_DEVICE"

    device_name = input("Device name [Gabe Matrix Actions Bridge]: ").strip()
    if not device_name:
        device_name = "Gabe Matrix Actions Bridge"

    print()
    print("-" * 70)
    print("Matrix Room Configuration")
    print("-" * 70)
    print()
    print("To find the room ID:")
    print("  1. Join #gabes-clearing:ep2.local in Element client")
    print("  2. Go to Room Settings → Advanced")
    print("  3. Copy 'Internal room ID'")
    print()

    room_id = input("Gabe's Clearing room ID: ").strip()
    if not room_id:
        print("⚠️  Skipping room ID configuration (you can add it later)")
        room_id = None

    print()
    print("-" * 70)
    print("Confirmation")
    print("-" * 70)
    print()
    print(f"Homeserver:   {homeserver}")
    print(f"User ID:      {user_id}")
    print(f"Password:     {'*' * len(password)}")
    print(f"Device ID:    {device_id}")
    print(f"Device Name:  {device_name}")
    if room_id:
        print(f"Room ID:      {room_id}")
    print()

    confirm = input("Store these credentials in 1Password vault? [y/N]: ").strip().lower()
    if confirm != 'y':
        print("❌ Cancelled")
        sys.exit(0)

    print()
    print("Storing credentials in vault...")

    # Store Matrix bot credentials
    try:
        vault.set_matrix_credentials(
            bot_name="gabe",
            homeserver=homeserver,
            user_id=user_id,
            password=password,
            device_id=device_id,
            device_name=device_name
        )
        print("✅ Matrix bot credentials stored: matrix-gabe")
    except Exception as e:
        print(f"❌ Failed to store Matrix credentials: {e}")
        sys.exit(1)

    # Store room ID if provided
    if room_id:
        try:
            vault.set_matrix_room_id(
                room_alias="gabes-clearing",
                room_id=room_id,
                description="Gabe's Clearing - ChatGPT Custom GPT governance room"
            )
            print("✅ Room ID stored: matrix-room-gabes-clearing")
        except Exception as e:
            print(f"❌ Failed to store room ID: {e}")
            # Don't exit - bot credentials are more important

    print()
    print("=" * 70)
    print("✅ Setup Complete!")
    print("=" * 70)
    print()
    print("Next steps:")
    print("  1. Test the configuration:")
    print("     cd repos/hippocamp/matrix_actions_api")
    print("     ./run_with_vault.sh --dev")
    print()
    print("  2. Verify the server starts and loads credentials")
    print()
    print("  3. Generate OpenAPI schema:")
    print("     curl http://localhost:8080/openapi.json > gabe-matrix-actions-openapi.json")
    print()
    print("  4. Configure ChatGPT Custom GPT Actions with the schema")
    print()
    print("For full deployment instructions, see DEPLOYMENT.md")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        print("❌ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
