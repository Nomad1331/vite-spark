# Discord Bot Setup Guide

## Files in this folder

- `config.py` - Configuration loader with web sync support
- `database.py` - Database class with web app sync methods
- `rank_card.py` - Rank card image generator
- `.env.example` - Example environment variables

## Setup Instructions

### 1. Copy files to your bot project
Copy all `.py` files to your Discord bot's root directory.

### 2. Set up environment variables
Copy `.env.example` to `.env` and fill in your values:

```env
DISCORD_TOKEN=your_discord_bot_token
SUPABASE_URL=https://gdkpmyznxfthobxpyryx.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
BOT_SYNC_SECRET=your_shared_secret_here
```

### 3. Install aiohttp dependency
```bash
pip install aiohttp
```

### 4. Use web sync in your bot

After XP is awarded, sync to web app:

```python
# In on_message or wherever XP is awarded:
xp_gain = 25
db.add_xp(user_id, guild_id, xp_gain)

# Sync to web app (async)
await db.sync_xp_to_web(str(user.id), xp_gain, "discord_message")
```

When a user chooses a class:

```python
db.set_user_class(user_id, guild_id, "TANK")
await db.sync_class_to_web(str(user.id), "TANK")
```

### 5. BOT_SYNC_SECRET

This is a password YOU create. Use the same value in:
1. Supabase Edge Function secrets (already added via Lovable)
2. Your bot's `.env` file

Generate a secure random string (32+ characters recommended).

## Notes

- The bot.py file is too large to include here. Use your existing bot.py
- Web sync is optional - if secrets aren't configured, sync silently fails
- XP sync is capped at 1000 XP per call (enforced by edge function)
