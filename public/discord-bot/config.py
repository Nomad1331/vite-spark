import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Discord Bot Token
TOKEN = os.getenv("DISCORD_TOKEN")

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Web App Sync Secret (shared between bot and edge function)
BOT_SYNC_SECRET = os.getenv("BOT_SYNC_SECRET")

# Service Role Key (for authenticated API calls)
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not TOKEN:
    raise ValueError("DISCORD_TOKEN not found in environment variables!")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE credentials not found in environment variables!")

# Optional: Warn if sync secret is missing (bot will work but won't sync to web)
if not BOT_SYNC_SECRET:
    print("⚠️ BOT_SYNC_SECRET not set - web app sync disabled")

if not SUPABASE_SERVICE_ROLE_KEY:
    print("⚠️ SUPABASE_SERVICE_ROLE_KEY not set - web app sync disabled")
