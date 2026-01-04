import discord
from discord.ext import commands, tasks
import os
import random
from datetime import datetime
from supabase import create_client, Client
import config as bot_config
from PIL import Image, ImageDraw, ImageFont
import ast
import asyncio
import json
from calendar import monthrange
import config as bot_config
import math
from database import Database
from rank_card import create_rank_card
_formula_cache = {}
# Guild settings cache to avoid database spam
_guild_settings_cache = {}
_CACHE_TTL = 600  # 5 minutes

def get_cached_guild_settings(guild_id):
    """Get guild settings with caching to prevent database spam"""
    now = datetime.now().timestamp()
    cache_key = str(guild_id)
    
    # Check if cached and not expired
    if cache_key in _guild_settings_cache:
        cached_data, timestamp = _guild_settings_cache[cache_key]
        if now - timestamp < _CACHE_TTL:
            # Uncomment for debugging: print(f"Cache HIT for guild {guild_id}")
            return cached_data
    
    # Cache miss - fetch from database
    print(f"Cache MISS for guild {guild_id} - fetching from DB")
    settings = db.get_guild_settings(guild_id)
    _guild_settings_cache[cache_key] = (settings, now)
    return settings


INTENTS = discord.Intents.default()
INTENTS.message_content = True
INTENTS.members = True
INTENTS.voice_states = True

bot = commands.Bot(command_prefix="!", intents=INTENTS, help_command=None)
db = Database("system.db")

# Initialize Supabase
try:
    supabase: Client = create_client(bot_config.SUPABASE_URL, bot_config.SUPABASE_KEY)
    print("✅ Connected to Supabase")
except Exception as e:
    print(f"❌ Failed to connect to Supabase: {e}")
    supabase = None

FONT_PATH = "assets/fonts/Cinzel-SemiBold.ttf"
IMAGE_PATH = "assets/images"

RANK_IMAGES = {
    ("E-RANK", "D-RANK"): "e_to_d.png",
    ("D-RANK", "C-RANK"): "d_to_c.png",
    ("C-RANK", "B-RANK"): "c_to_b.png",
    ("B-RANK", "A-RANK"): "b_to_a.png",
    ("A-RANK", "S-RANK"): "a_to_s.png",
}

# Server IDs
TEST_SERVER_ID = "977466577538666546"  # Replace with your test server ID
MAIN_SERVER_ID = "1445843089213362248"  # Replace with Sydev's Gate of Greatness ID

# Role IDs per server
SERVER_RANK_ROLES = {
    TEST_SERVER_ID: {
        "S-RANK": 1451273403775451166,
        "A-RANK": 1451273345919094865,
        "B-RANK": 1451273300243251522,
        "C-RANK": 1451273274028986448,
        "D-RANK": 1451273135142998077,
        "E-RANK": 1451273172023247082,
    },
    MAIN_SERVER_ID: {
        "S-RANK": 1445845873643749546,  # Replace with main server S-RANK role ID
        "A-RANK": 1445843089213362251,  # Replace with main server A-RANK role ID
        "B-RANK": 1445843089213362250,
        "C-RANK": 1445845107126440047,
        "D-RANK": 1445844811142926376,
        "E-RANK": 1445843089213362249,
    }
}

# Season Champion roles per server
SERVER_SEASON_CHAMPION = {
    TEST_SERVER_ID: 1452912820458098799,
    MAIN_SERVER_ID: 1453304099758932073  # Replace with main server Season Champion role ID
}

# Class roles per server
SERVER_CLASS_ROLES = {
    TEST_SERVER_ID: {
        "TANK": 1453496279626944792,      # Replace with test server [TANK] role ID
        "ASSASSIN": 1453496331661213726,
        "FIGHTER": 1453496421100556359,
        "RANGER": 1453496450997555333,
        "HEALER": 1453496694066122925,
        "MAGE": 1453496766027661343,
    },
    MAIN_SERVER_ID: {
        "TANK": 1447486238880960523,      # Replace with main server [TANK] role ID
        "ASSASSIN": 1445846158759956632,
        "FIGHTER": 1447486553218617436,
        "RANGER": 1445847857524510965,
        "HEALER": 1445847558814699551,
        "MAGE": 1445846141861105835,
    }
}

# -------------------------
# SUPABASE HELPERS
# -------------------------
def get_web_app_user(discord_id):
    """Get user's web app data from Supabase"""
    if not supabase:
        return None
    
    try:
        # First get profile
        profile_result = supabase.table('profiles').select('user_id, hunter_name, avatar, title').eq('discord_id', str(discord_id)).execute()
        
        if not profile_result.data:
            return None
        
        profile = profile_result.data[0]
        
        # Then get stats
        stats_result = supabase.table('player_stats').select('*').eq('user_id', profile['user_id']).execute()
        
        if not stats_result.data:
            return None
        
        stats = stats_result.data[0]
        
        # Combine data
        return {
            'discord_id': str(discord_id),
            'hunter_name': profile['hunter_name'],
            'avatar': profile.get('avatar'),
            'title': profile.get('title'),
            'level': stats['level'],
            'total_xp': stats['total_xp'],
            'weekly_xp': stats.get('weekly_xp', 0),
            'rank': stats['rank'],
            'strength': stats['strength'],
            'agility': stats['agility'],
            'intelligence': stats['intelligence'],
            'vitality': stats['vitality'],
            'sense': stats['sense'],
            'gold': stats.get('gold', 0),
            'gems': stats.get('gems', 0),
            'credits': stats.get('credits', 0),
        }
    except Exception as e:
        print(f"Error fetching web app user: {e}")
        return None
    
# Helper functions to get server-specific roles
def get_rank_roles(guild_id):
    guild_id_str = str(guild_id)
    return SERVER_RANK_ROLES.get(guild_id_str, SERVER_RANK_ROLES.get(TEST_SERVER_ID))

def get_season_champion_role(guild_id):
    guild_id_str = str(guild_id)
    return SERVER_SEASON_CHAMPION.get(guild_id_str, SERVER_SEASON_CHAMPION.get(TEST_SERVER_ID))

def get_class_roles(guild_id):
    guild_id_str = str(guild_id)
    return SERVER_CLASS_ROLES.get(guild_id_str, SERVER_CLASS_ROLES.get(TEST_SERVER_ID))

# Keep these for backward compatibility
RANK_ROLES = SERVER_RANK_ROLES.get(TEST_SERVER_ID)
SEASON_CHAMPION_ROLE = SERVER_SEASON_CHAMPION.get(TEST_SERVER_ID)
CLASS_ROLES = SERVER_CLASS_ROLES.get(TEST_SERVER_ID)

# Minimum level to choose a class
CLASS_UNLOCK_LEVEL = 10

# Voice tracking
voice_tracking = {}

# Simple in-memory anti-spam cache: {guild_id: {user_id: [timestamps]}}
message_cache = {}
MAX_MESSAGES_WINDOW = 5  # messages
WINDOW_SECONDS = 10      # in seconds
MUTE_WARN_THRESHOLD = 8  # high threshold to consider action (not muting here)
# store last message content per (guild_id, user_id)
last_message_cache = {}

# -------------------------
# XP / LEVEL SYSTEM (supports per-guild formulas)
# -------------------------
DEFAULT_XP_FORMULA = "level * 100"


def _validate_formula_ast(expr: str):
    """Raise ValueError if AST contains disallowed nodes/names.

    Compatible with Python 3.8+ (no reliance on ast.Num). Allows only 'level',
    arithmetic operators, and calls to safe functions (int, pow, round).
    """
    allowed_func_names = {'int', 'pow', 'round'}
    allowed_name_ids = {'level'} | allowed_func_names

    tree = ast.parse(expr, mode='eval')

    for node in ast.walk(tree):
        # Calls: only allow calling safe functions
        if isinstance(node, ast.Call):
            if not (isinstance(node.func, ast.Name) and node.func.id in allowed_func_names):
                raise ValueError("Only calls to int(), pow(), or round() are allowed in formulas")
        # Names: allow level and allowed function names
        elif isinstance(node, ast.Name):
            if node.id not in allowed_name_ids:
                raise ValueError("Only the variable 'level' and safe functions (int, pow, round) are allowed in formulas")
        # Constants (numbers) are fine
        elif isinstance(node, ast.Constant):
            if not isinstance(node.value, (int, float)):
                raise ValueError("Only numeric constants are allowed in formulas")
        # Permit basic expression/operation nodes
        elif isinstance(node, (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Load,
                               ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow,
                               ast.Mod, ast.FloorDiv, ast.UAdd, ast.USub, ast.Call)):
            continue
        else:
            raise ValueError(f"Disallowed expression in formula: {type(node).__name__}")
    return True


def evaluate_formula(formula: str, level: int) -> int:
    # Cache compiled formula to prevent repeated AST parsing
    if formula not in _formula_cache:
        tree = ast.parse(formula, mode='eval')
        _validate_formula_ast(formula)
        code = compile(tree, '<xp_formula>', 'eval')
        _formula_cache[formula] = code

    code = _formula_cache[formula]

    return int(eval(
        code,
        {"__builtins__": None},
        {
            "level": level,
            "int": int,
            "pow": pow,
            "round": round,
            "max": max,
            "min": min
        }
    ))



def xp_for_level(level: int, guild_id: str = None) -> int:
    """XP required to go from level (L-1) to level L.
    
    SIMPLIFIED: Always use level * 100 to match web app.
    """
    return level * 100



def total_xp_to_level(level: int, guild_id: str = None) -> int:
    return sum(xp_for_level(l, guild_id) for l in range(1, level + 1))


# Cache of prefix sums per guild to speed up level lookups: {guild_id: {level: total_xp_to_level(level)}}
_level_prefix_cache = {}

def level_from_xp(total_xp: int, guild_id: str = None) -> int:
    """Compute level from total XP efficiently using exponential + binary search.

    Uses a per-guild cache of prefix sums to avoid recomputing cumulative XP for the
    same levels repeatedly (important when users have very large XP values).
    """
    if total_xp <= 0:
        return 0

    cache_key = str(guild_id)
    cache = _level_prefix_cache.setdefault(cache_key, {0: 0})

    # Helper to get total_xp_to_level(n) using cached prefix sums
    def _get_prefix(n: int) -> int:
        if n in cache:
            return cache[n]
        # find nearest cached smaller level
        lower_levels = [k for k in cache.keys() if k < n]
        if lower_levels:
            m = max(lower_levels)
            total = cache[m]
            start = m + 1
        else:
            total = 0
            start = 1
        for l in range(start, n + 1):
            total += xp_for_level(l, guild_id)
        cache[n] = total
        return total

    # Fast path: detect arithmetic progression (xp_per_level = a*level + b)
    try:
        x1 = xp_for_level(1, guild_id)
        x2 = xp_for_level(2, guild_id)
        x3 = xp_for_level(3, guild_id)
        # if differences equal, assume linear progression
        if (x2 - x1) == (x3 - x2):
            a = x2 - x1
            b = x1 - a
            # cumulative: S(n) = a * n*(n+1)/2 + b*n
            # Solve a/2 n^2 + (a/2 + b) n - total_xp <= 0
            A = a / 2.0
            B = a / 2.0 + b
            C = -total_xp
            # quadratic formula
            discr = B * B - 4 * A * C
            if discr >= 0 and A != 0:
                n_est = int(math.floor((-B + math.sqrt(discr)) / (2 * A)))
                if n_est < 0:
                    n_est = 0
                # Adjust up/down to correct integer by checking prefix sums
                if _get_prefix(n_est) > total_xp:
                    while n_est > 0 and _get_prefix(n_est) > total_xp:
                        n_est -= 1
                else:
                    while _get_prefix(n_est + 1) <= total_xp:
                        n_est += 1
                return n_est
    except Exception:
        # If fast path fails for any reason, fall back to search path
        pass

    # Exponential search to find an upper bound
    hi = 1
    while _get_prefix(hi) <= total_xp:
        hi *= 2

    lo = 0
    # Binary search for the largest level with prefix <= total_xp
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if _get_prefix(mid) <= total_xp:
            lo = mid
        else:
            hi = mid - 1

    return lo


def safe_level_from_xp(total_xp: int, guild_id: str = None) -> int:
    """Safe wrapper around level_from_xp that catches and logs exceptions."""
    try:
        return level_from_xp(total_xp, guild_id)
    except Exception as e:
        print(f"Error computing level for guild {guild_id}, xp {total_xp}: {e}")
        return 0

def rank_from_level(level: int) -> str:
    if level >= 150:
        return "S-RANK"
    if level >= 100:
        return "A-RANK"
    if level >= 75:
        return "B-RANK"
    if level >= 50:
        return "C-RANK"
    if level >= 26:
        return "D-RANK"
    return "E-RANK"

# -------------------------
# IMAGE GENERATION
# -------------------------
def generate_rank_image(username, old_rank, new_rank):
    key = (old_rank, new_rank)
    if key not in RANK_IMAGES:
        return None

    img_path = os.path.join(IMAGE_PATH, RANK_IMAGES[key])
    if not os.path.exists(img_path):
        print(f"generate_rank_image: template not found: {img_path}")
        return None

    try:
        img = Image.open(img_path).convert("RGBA")
    except Exception as e:
        print(f"generate_rank_image: error opening template: {e}")
        return None

    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype(FONT_PATH, 48)
    except Exception:
        font = ImageFont.load_default()

    text = f"{username}"
    x = img.width // 2
    y = 380

    draw.text((x, y), text, font=font, fill=(180, 220, 255), anchor="mm")

    # Create a safe, unique filename
    safe_name = ''.join(c for c in username if c.isalnum() or c in ('_', '-')).strip() or 'user'
    ts = int(datetime.now().timestamp() * 1000)
    os.makedirs("temp", exist_ok=True)
    output = f"temp/rank_{safe_name}_{ts}.png"

    try:
        img.save(output)
        img.close()
    except Exception as e:
        print(f"generate_rank_image: error saving image for {username}: {e}")
        # Ensure no corrupted file remains
        try:
            if os.path.exists(output):
                os.remove(output)
        except Exception:
            pass
        return None

    # Verify file exists and is non-empty
    try:
        if not os.path.exists(output) or os.path.getsize(output) == 0:
            print(f"generate_rank_image: output file invalid or empty: {output}")
            try:
                if os.path.exists(output):
                    os.remove(output)
            except Exception:
                pass
            return None
        # Success - log file size
        print(f"generate_rank_image: created {output} ({os.path.getsize(output)} bytes)")
    except Exception as e:
        print(f"generate_rank_image: error checking output file: {e}")
        return None

    return output


# -------------------------
# EVENTS
# -------------------------
@bot.event
async def on_ready():
    print(f"🔮 SYSTEM ONLINE — Logged in as {bot.user}")

    # Start the voice XP task only if not already running (avoid RuntimeError on hot reloads)
    try:
        if not voice_xp_task.is_running():
            voice_xp_task.start()
    except Exception as e:
        print(f"Warning: could not start voice_xp_task: {e}")

    # Start the season check task
    try:
        if not check_season_end.is_running():
            check_season_end.start()
    except Exception as e:
        print(f"Warning: could not start check_season_end: {e}")

    # Sync global slash commands in background (global registration may take time)
    async def _sync():
        await bot.wait_until_ready()
        try:
            await bot.tree.sync()
            print("🔁 Synced global slash commands")
        except Exception as e:
            print(f"Error syncing app commands: {e}")
    bot.loop.create_task(_sync())

@bot.event
async def on_message(message):
    if message.author.bot or not message.guild:
        return

    # Load guild settings early so we can respect prefix toggle
    settings = db.get_guild_settings(message.guild.id)
    prefix_enabled = settings.get('prefix_commands_enabled', True)

    # Anti-spam: track recent messages per user per guild
    guild_cache = message_cache.setdefault(message.guild.id, {})
    user_times = guild_cache.setdefault(message.author.id, [])
    now_ts = datetime.now().timestamp()
    # remove old
    user_times = [t for t in user_times if now_ts - t <= WINDOW_SECONDS]
    user_times.append(now_ts)
    guild_cache[message.author.id] = user_times

    # If user sent too many messages in short window, ignore XP
    if len(user_times) > MAX_MESSAGES_WINDOW:
        # Optional: warn user once
        try:
            await message.add_reaction("⏱️")
        except:
            pass
        if prefix_enabled:
            await bot.process_commands(message)
        return

    # Check if channel is allowed
    if not db.is_channel_allowed(message.guild.id, message.channel.id):
        if prefix_enabled:
            await bot.process_commands(message)
        return

    # Ensure user exists
    user_data = db.get_user(message.author.id, message.guild.id)
    if not user_data:
        db.create_user(message.author.id, message.guild.id)
        user_data = db.get_user(message.author.id, message.guild.id)

    # Check cooldown (TANK gets 50% reduction: 30s → 15s)
    user_class = db.get_user_class(message.author.id, message.guild.id)
    cooldown_time = settings['xp_cooldown']
    
    if user_class == "TANK":
        cooldown_time = int(cooldown_time * 0.5)  # 50% reduction
    
    if not db.can_gain_xp(message.author.id, message.guild.id, cooldown=cooldown_time):
        if prefix_enabled:
            await bot.process_commands(message)
        return

    # Calculate XP with guild settings
    old_level = level_from_xp(user_data['xp'], message.guild.id)
    base_xp = random.randint(settings['xp_min'], settings['xp_max'])
    
    # Apply role multiplier
    multiplier = db.get_user_multiplier(message.author)
    
    # Apply CLASS bonuses
    user_class = db.get_user_class(message.author.id, message.guild.id)
    
    if user_class == "TANK":
        # 0.9x message XP (focuses on voice)
        multiplier *= 0.9
    
    elif user_class == "ASSASSIN":
        # 1.5x base + combo bonus
        multiplier *= 1.5
        
        # 15% chance for double XP
        if random.random() < 0.15:
            multiplier *= 2.0
            try:
                await message.add_reaction("💥")  # Crit feedback
            except:
                pass
        
        # Combo system: +5% per message in a row (max 20%)
        combo = db.get_message_combo(message.author.id, message.guild.id)
        combo_bonus = min(combo * 0.05, 0.20)
        multiplier *= (1 + combo_bonus)
        
        # Increment combo
        db.increment_message_combo(message.author.id, message.guild.id)
    
    elif user_class == "FIGHTER":
        # 1.2x base + daily streak bonus
        multiplier *= 1.2
        
        # Daily streak bonus: +5% per day (max 25%)
        streak = user_data.get('daily_streak', 0)
        streak_bonus = min(streak * 0.05, 0.25)
        multiplier *= (1 + streak_bonus)
    
    elif user_class == "RANGER":
        # 2x if in focus channel, 0.8x otherwise
        focus_channel = db.get_focus_channel(message.author.id, message.guild.id)
        if focus_channel and str(message.channel.id) == focus_channel:
            multiplier *= 2.0
        else:
            multiplier *= 0.8
    
    elif user_class == "HEALER":
        # 0.9x solo XP
        multiplier *= 0.9
        
        # Check for @mention + helping (25 XP bonus)
        if len(message.mentions) > 0 and len(message.content) >= 20:
            # Check cooldown (5 min)
            if user_data.get('last_mention_xp'):
                last_time = datetime.fromisoformat(user_data['last_mention_xp'])
                if (datetime.now() - last_time).total_seconds() >= 300:
                    base_xp += 25
                    # Update last mention time
                    try:
                        db.set_last_mention_time(message.author.id, message.guild.id)
                    except Exception as e:
                        print(f"Warning: failed to set last_mention_xp for {message.author.id}: {e}")
            else:
                # First time
                base_xp += 25
                try:
                    db.set_last_mention_time(message.author.id, message.guild.id)
                except Exception as e:
                    print(f"Warning: failed to set last_mention_xp for {message.author.id}: {e}")
    
    elif user_class == "MAGE":
        # 1.4x for long messages (50+ chars), 0.7x for short (<20)
        msg_len = len(message.content)
        if msg_len >= 50:
            multiplier *= 1.4
        elif msg_len < 20:
            multiplier *= 0.7
    
    # Anti-spam: prevent identical-message farming
    xp_gain = int(base_xp * multiplier)
    
    # Simple duplicate content check (FIGHTER is immune)
    if user_class != "FIGHTER":
        key = (message.guild.id, message.author.id)
        last_msg = last_message_cache.get(key)
        content = message.content.strip()
        if last_msg and last_msg == content and len(content) > 0:
            xp_gain = max(1, xp_gain // 3)
        last_message_cache[key] = content
    
    db.add_xp(message.author.id, message.guild.id, xp_gain)
    
    # Sync XP to web app (fire-and-forget, non-blocking)
    asyncio.create_task(db.sync_xp_to_web(str(message.author.id), xp_gain, "discord_message"))
    
    # Check for level up
    new_data = db.get_user(message.author.id, message.guild.id)
    new_level = level_from_xp(new_data['xp'], message.guild.id)
    
    if new_level > old_level and settings['levelup_messages']:
        # Use custom levelup channel if set
        if settings['levelup_channel']:
            try:
                levelup_channel = message.guild.get_channel(int(settings['levelup_channel']))
                if levelup_channel:
                    await handle_levelup(message.author, message.guild, levelup_channel, old_level, new_level)
                else:
                    await handle_levelup(message.author, message.guild, message.channel, old_level, new_level)
            except:
                await handle_levelup(message.author, message.guild, message.channel, old_level, new_level)
        else:
            await handle_levelup(message.author, message.guild, message.channel, old_level, new_level)

    if prefix_enabled:
        await bot.process_commands(message)

@bot.event
async def on_voice_state_update(member, before, after):
    if member.bot:
        return
    
    # User joined voice
    if before.channel is None and after.channel is not None:
        voice_tracking[member.id] = datetime.now()
    
    # User left voice
    elif before.channel is not None and after.channel is None:
        if member.id in voice_tracking:
            time_spent = (datetime.now() - voice_tracking[member.id]).total_seconds()
            # Award XP for every minute
            xp_gain = int((time_spent / 60) * 5)
            
            # TANK gets 1.8x voice XP
            user_class = db.get_user_class(member.id, member.guild.id)
            if user_class == "TANK":
                xp_gain = int(xp_gain * 1.8)
            elif user_class == "ASSASSIN":
                xp_gain = int(xp_gain * 0.8)  # Assassin penalty
            elif user_class == "FIGHTER":
                xp_gain = int(xp_gain * 1.2)
            elif user_class == "HEALER":
                xp_gain = int(xp_gain * 0.9)
            
            user_data = db.get_user(member.id, member.guild.id)
            if not user_data:
                db.create_user(member.id, member.guild.id)
                user_data = db.get_user(member.id, member.guild.id)
            
            old_level = level_from_xp(user_data['xp'], member.guild.id)
            db.add_xp(member.id, member.guild.id, xp_gain)
            
            # Sync voice XP to web app
            asyncio.create_task(db.sync_xp_to_web(str(member.id), xp_gain, "discord_voice"))
            
            # track voice time (seconds)
            db.add_voice_time(member.id, member.guild.id, int(time_spent))
            
            new_data = db.get_user(member.id, member.guild.id)
            new_level = level_from_xp(new_data['xp'], member.guild.id)
            
            if new_level > old_level:
                # Use custom levelup channel if set (same logic as on_message)
                settings = db.get_guild_settings(member.guild.id)
                if settings['levelup_channel']:
                    try:
                        levelup_channel = member.guild.get_channel(int(settings['levelup_channel']))
                        if levelup_channel:
                            await handle_levelup(member, member.guild, levelup_channel, old_level, new_level)
                        else:
                            # Fallback if custom channel not found
                            channel = member.guild.system_channel or member.guild.text_channels[0]
                            await handle_levelup(member, member.guild, channel, old_level, new_level)
                    except:
                        # Fallback on error
                        channel = member.guild.system_channel or member.guild.text_channels[0]
                        await handle_levelup(member, member.guild, channel, old_level, new_level)
                else:
                    # No custom channel set, use default
                    channel = member.guild.system_channel or member.guild.text_channels[0]
                    await handle_levelup(member, member.guild, channel, old_level, new_level)
            
            del voice_tracking[member.id]

# -------------------------
# ROLE MANAGEMENT - STACKING VERSION
# -------------------------
async def update_rank_roles(member, new_rank):
    """Update user's rank roles - ADD new rank, KEEP all lower ranks"""
    try:
        # Define rank hierarchy (lowest to highest)
        rank_hierarchy = ["E-RANK", "D-RANK", "C-RANK", "B-RANK", "A-RANK", "S-RANK"]
        new_rank_index = rank_hierarchy.index(new_rank)
        
        # Get all rank roles that should be added (current and below)
        roles_to_have = []
        for i in range(new_rank_index + 1):
            rank = rank_hierarchy[i]
            role_id = get_rank_roles(member.guild.id).get(rank)
            if role_id:
                role = member.guild.get_role(role_id)
                if role:
                    roles_to_have.append(role)
        
        # Get current rank roles user has
        current_rank_roles = []
        for role_id in RANK_ROLES.values():
            role = member.guild.get_role(role_id)
            if role and role in member.roles:
                current_rank_roles.append(role)
        
        # Find roles to add (roles user should have but doesn't)
        roles_to_add = [r for r in roles_to_have if r not in current_rank_roles]
        
        # Remove ranks ABOVE current rank (if user was downgraded)
        roles_to_remove = [r for r in current_rank_roles if r not in roles_to_have]
        
        # Remove higher ranks with rate limit protection
        if roles_to_remove:
            await member.remove_roles(*roles_to_remove, reason="Rank update")
            await asyncio.sleep(0.5)  # ← Prevent Discord rate limits
        
        # Add missing ranks with rate limit protection
        if roles_to_add:
            await member.add_roles(*roles_to_add, reason=f"Achieved {new_rank}")
            await asyncio.sleep(0.5)  # ← Prevent Discord rate limits
            return True
        
        return False
    except Exception as e:
        print(f"Error updating roles: {e}")
        return False


# -------------------------
# LEVEL UP HANDLER - SIMPLIFIED
# -------------------------
# recent levelups cache to avoid duplicate announcements: (member_id, new_level) -> timestamp
_recent_levelups = {}
_LEVELUP_TTL = 5  # seconds

async def handle_levelup(member, guild, channel, old_level, new_level, *, force: bool = False):
    old_rank = rank_from_level(old_level)
    new_rank = rank_from_level(new_level)

    # Deduplicate duplicate levelup events (possible due to retries/duplicate invocations)
    try:
        key = (str(member.id), int(new_level))
        now_ts = datetime.now().timestamp()
        # cleanup
        for k, t in list(_recent_levelups.items()):
            if now_ts - t > _LEVELUP_TTL:
                _recent_levelups.pop(k, None)
        # If not forced, respect dedupe to avoid duplicate announcements
        if not force and key in _recent_levelups:
            print(f"Duplicate levelup for {member.id} -> level {new_level} ignored")
            return
        _recent_levelups[key] = now_ts
    except Exception as e:
        print(f"handle_levelup: dedupe error: {e}")

    # Update roles
    await update_rank_roles(member, new_rank)
    
    # Check for rank up (ONLY rank up gets image)
    if old_rank != new_rank:
        img = generate_rank_image(member.name, old_rank, new_rank)
        # Verify image file path and size before attempting to send
        if img and os.path.exists(img) and os.path.getsize(img) > 0:
            try:
                await channel.send(
                    f"🔮 **SYSTEM ALERT**\n"
                    f"{member.mention} has ascended.\n\n"
                    f"**{old_rank} → {new_rank}**\n"
                    f"Role unlocked: <@&{get_rank_roles(guild.id)[new_rank]}>",
                    file=discord.File(img)
                )
                try:
                    os.remove(img)
                except Exception:
                    pass
            except Exception as e:
                print(f"Error sending rank image: {e}")
                # Fallback: send text-only announcement
                try:
                    await channel.send(
                        f"🔮 **SYSTEM ALERT**\n"
                        f"{member.mention} has ascended.\n\n"
                        f"**{old_rank} → {new_rank}**\n"
                        f"Role unlocked: <@&{get_rank_roles(guild.id)[new_rank]}>"
                    )
                except Exception as e2:
                    print(f"Error sending fallback rank announcement: {e2}")
        else:
            # Image invalid; send fallback announcement and log
            print(f"handle_levelup: no valid image to send for {member.name} ({old_rank}→{new_rank}), img={img}")
            try:
                await channel.send(
                    f"🔮 **SYSTEM ALERT**\n"
                    f"{member.mention} has ascended.\n\n"
                    f"**{old_rank} → {new_rank}**\n"
                    f"Role unlocked: <@&{RANK_ROLES[new_rank]}>"
                )
            except Exception as e:
                print(f"Error sending fallback rank announcement: {e}")
    else:
        # Regular level up - JUST TEXT, NO IMAGE
        try:
            # Custom message with personality
            rank_flavor = {
                "E-RANK": "Still grinding!",
                "D-RANK": "Building strength!",
                "C-RANK": "Getting stronger!",
                "B-RANK": "Rising through the ranks!",
                "A-RANK": "Elite hunter status!",
                "S-RANK": "Legendary power!"
            }
            
            flavor_text = rank_flavor.get(new_rank, "Keep going!")
            
            await channel.send(
                f"⚡ **LEVEL UP**\n"
                f"{member.mention} reached **Level {new_level}**! {flavor_text}"
            )
        except Exception as e:
            print(f"Error sending level up message: {e}")

# -------------------------
# VOICE XP TASK
# -------------------------
@tasks.loop(minutes=5)
async def voice_xp_task():
    """Award XP to users in voice channels"""
    for guild in bot.guilds:
        for channel in guild.voice_channels:
            # Check if any HEALER is in VC for aura bonus
            healers_present = []
            for member in channel.members:
                if not member.bot:
                    user_class = db.get_user_class(member.id, guild.id)
                    if user_class == "HEALER":
                        healers_present.append(member.id)
            
            for member in channel.members:
                if not member.bot:
                    user_data = db.get_user(member.id, guild.id)
                    if not user_data:
                        db.create_user(member.id, guild.id)
                    
                    xp_gain = 25
                    
                    # Apply class modifiers
                    user_class = db.get_user_class(member.id, guild.id)
                    if user_class == "TANK":
                        xp_gain = int(xp_gain * 1.8)
                    elif user_class == "ASSASSIN":
                        xp_gain = int(xp_gain * 0.8)
                    elif user_class == "FIGHTER":
                        xp_gain = int(xp_gain * 1.2)
                    elif user_class == "HEALER":
                        xp_gain = int(xp_gain * 0.9)
                    
                    # HEALER aura: +5% for everyone in VC
                    if healers_present and member.id not in healers_present:
                        xp_gain = int(xp_gain * 1.05)
                    
                    db.add_xp(member.id, guild.id, xp_gain)
                    
                    # Sync voice task XP to web app
                    asyncio.create_task(db.sync_xp_to_web(str(member.id), xp_gain, "discord_voice_task"))
                    
                    # account for 5 minutes of voice time
                    db.add_voice_time(member.id, guild.id, 5 * 60)

@tasks.loop(hours=1)
async def check_season_end():
    """Check if season should end (runs every hour)"""
    now = datetime.now()
    
    last_day = monthrange(now.year, now.month)[1]
    if now.day == last_day and now.hour >= 23:
        for guild in bot.guilds:
            try:
                result = await end_current_season(guild)
                
                channel = guild.system_channel or guild.text_channels[0]
                if channel:
                    await channel.send(result)
            except Exception as e:
                print(f"Error ending season for guild {guild.id}: {e}")

# -------------------------
# NEW COMMANDS: weekly, stats, rewards
# -------------------------
@bot.command()
async def link(ctx):
    """Check if your Discord account is linked to the web app"""
    discord_id = str(ctx.author.id)
    
    if not supabase:
        await ctx.send("❌ Supabase connection not available. Contact admin.")
        return
    
    # Check if user is linked
    web_user = get_web_app_user(discord_id)
    
    if web_user:
        embed = discord.Embed(
            title="✅ Account Linked!",
            description=f"Your Discord is connected to: **{web_user['hunter_name']}**",
            color=0x00ff00
        )
        embed.add_field(name="Level", value=str(web_user['level']), inline=True)
        embed.add_field(name="Rank", value=web_user['rank'], inline=True)
        embed.add_field(name="Total XP", value=f"{web_user['total_xp']:,}", inline=True)
        embed.add_field(name="Power", value=str(web_user['strength'] + web_user['agility'] + web_user['intelligence'] + web_user['vitality'] + web_user['sense']), inline=True)
        embed.set_footer(text="View full profile: https://sololevelling-app.vercel.app/")
        
        await ctx.send(embed=embed)
    else:
        embed = discord.Embed(
            title="🔗 Link Your Account",
            description=(
                "Connect your Discord to the Solo Leveling web app!\n\n"
                "**Easiest Method - Discord OAuth:**\n"
                "1. Go to: https://sololevelling-app.vercel.app/auth\n"
                "2. Click **Continue with Discord**\n"
                "3. Authorize the app\n"
                "4. Your accounts will be linked automatically!\n\n"
                "**Why link?**\n"
                "• View your real progress in Discord\n"
                "• Get XP for completing actual quests\n"
                "• Sync habits, gates, and achievements\n"
                "• Hybrid XP system (web app + Discord chat)\n"
            ),
            color=0x00d4ff
        )
        embed.set_footer(text=f"Your Discord ID: {discord_id}")
        
        await ctx.send(embed=embed)

@bot.command()
async def weekly(ctx, page: int = 1):
    """Weekly leaderboard: top XP gained in last 7 days"""
    limit = 10
    offset = (page - 1) * limit

    rows = db.get_weekly_leaderboard(ctx.guild.id, days=7, limit=100)
    if not rows:
        await ctx.send("No weekly data yet. Start chatting to earn XP this week!")
        return

    start = offset
    end = min(offset + limit, len(rows))
    page_data = rows[start:end]

    embed = discord.Embed(
        title="🏆 WEEKLY LEADERBOARD", 
        description=f"Top hunters this week in **{ctx.guild.name}**", 
        color=0x00ff99
    )

    for i, (user_id, xp) in enumerate(page_data, start=start+1):
        try:
            member = await ctx.guild.fetch_member(int(user_id))
            try:
                level = safe_level_from_xp(db.get_user(member.id, ctx.guild.id)['xp'], ctx.guild.id)
            except Exception as e:
                print(f"weekly leaderboard: failed to compute level for user {user_id}: {e}")
                level = 0
            rank_str = rank_from_level(level)
            
            # Add medals for top 3
            medal = ""
            if i == 1:
                medal = "🥇 "
            elif i == 2:
                medal = "🥈 "
            elif i == 3:
                medal = "🥉 "
            
            embed.add_field(
                name=f"{medal}#{i} - {member.name}", 
                value=f"**{rank_str}** • Level {level} • {xp:,} XP (this week)", 
                inline=False
            )
        except:
            continue

    total_pages = (len(rows) + limit - 1) // limit
    embed.set_footer(text=f"Page {page}/{total_pages}")
    await ctx.send(embed=embed)

@bot.command()
async def stats(ctx, member: discord.Member = None):
    """Detailed stats for a user"""
    member = member or ctx.author
    user = db.get_user(member.id, ctx.guild.id)
    if not user:
        # create a DB row for users not yet tracked to avoid None errors
        db.create_user(member.id, ctx.guild.id)
        user = db.get_user(member.id, ctx.guild.id)

    total_xp = user['xp']
    level = level_from_xp(total_xp, ctx.guild.id)
    rank_str = rank_from_level(level)
    server_rank = db.get_rank(member.id, ctx.guild.id)
    weekly_xp = db.get_user_weekly_xp(member.id, ctx.guild.id, days=7)

    # Calculate XP progress (web app formula: level * 100)
    if level == 0:
        current_level_xp = total_xp
        next_level_xp = 100
    else:
        # Total XP needed to reach current level
        xp_at_current_level = sum(l * 100 for l in range(1, level + 1))
        # XP needed for next level
        next_level_xp = (level + 1) * 100
        # XP progress within current level
        current_level_xp = total_xp - xp_at_current_level

        # Safety check: if somehow negative, reset to 0
        if current_level_xp < 0:
            current_level_xp = 0

    embed = discord.Embed(title=f"📊 Stats - {member.name}", color=0x00d4ff)
    embed.add_field(name="Rank", value=rank_str, inline=True)
    embed.add_field(name="Level", value=str(level), inline=True)
    embed.add_field(name="Server Rank", value=f"#{server_rank}", inline=True)
    embed.add_field(name="Total XP", value=f"{total_xp:,}", inline=True)
    embed.add_field(name="This Week", value=f"{weekly_xp:,} XP", inline=True)
    embed.add_field(name="Messages", value=str(user.get('messages', 0)), inline=True)
    embed.add_field(name="Voice Time (s)", value=str(user.get('voice_time', 0)), inline=True)
    embed.add_field(name="Progress", value=f"{current_level_xp:,} / {next_level_xp:,} XP", inline=False)

    last_daily = user.get('last_daily')
    if last_daily:
        ld = datetime.fromisoformat(last_daily)
        embed.add_field(name="Last Daily", value=ld.strftime('%Y-%m-%d %H:%M:%S'), inline=True)

    await ctx.send(embed=embed)

@bot.command()
async def rewards(ctx):
    """List rewards/role unlocks for ranks"""
    embed = discord.Embed(title="🎁 Rewards & Role Unlocks", color=0xffc857)

    # Gather per-guild formula string for display
    settings = db.get_guild_settings(ctx.guild.id)
    formula_str = settings.get('xp_formula') or DEFAULT_XP_FORMULA

    ranks_info = [
        ("E-RANK", 1, 0, "🔴"),
        ("D-RANK", 26, total_xp_to_level(26, ctx.guild.id), "🟠"),
        ("C-RANK", 50, total_xp_to_level(50, ctx.guild.id), "🟡"),
        ("B-RANK", 75, total_xp_to_level(75, ctx.guild.id), "🟢"),
        ("A-RANK", 100, total_xp_to_level(100, ctx.guild.id), "🔵"),
        ("S-RANK", 150, total_xp_to_level(150, ctx.guild.id), "🟣"),
    ]

    for rank_name, level, total_xp, emoji in ranks_info:
        role_mention = f"<@&{RANK_ROLES.get(rank_name)}>" if RANK_ROLES.get(rank_name) else "None"
        embed.add_field(
            name=f"{emoji} {rank_name}",
            value=f"Level {level} • {total_xp:,} XP\nRole: {role_mention}",
            inline=True
        )

    # Add a final non-inline field with formula info
    embed.add_field(
        name="⚙️ XP Formula",
        value=f"Current formula: `{formula_str}`\nUse `/formula` to view or `/setformula` (admin-only) to change.",
        inline=False
    )

    await ctx.send(embed=embed)

# -------------------------
# FORMULA COMMANDS (ADMIN ONLY)
# -------------------------
@bot.command()
@commands.has_permissions(manage_guild=True)
async def formula(ctx):
    """Show the current XP formula for this server (admin-only)"""
    settings = db.get_guild_settings(ctx.guild.id)
    formula_str = settings.get('xp_formula') or DEFAULT_XP_FORMULA
    try:
        sample = xp_for_level(10, ctx.guild.id)
    except Exception:
        sample = 'N/A'
    await ctx.send(f"📐 Current XP formula: `{formula_str}`\nExample: `xp_for_level(10)` = {sample}")

@bot.command(name='setformula')
@commands.has_permissions(manage_guild=True)
async def setformula(ctx, *, formula: str):
    """Set a custom XP formula for this server (admin-only). Use `level` as the variable.

    Example: `/setformula int(level * 120 + 50)`
    """
    # Ask for explicit confirmation
    prompt = await ctx.send(
        f"⚠️ You are about to set the XP formula to:\n`{formula}`\n\nType **confirm** within 30 seconds to apply, or anything else to cancel.")

    def _check(m):
        return m.author == ctx.author and m.channel == ctx.channel and m.content.lower().strip() == 'confirm'

    try:
        await bot.wait_for('message', check=_check, timeout=30)
    except asyncio.TimeoutError:
        await ctx.send("❌ Cancelled: no confirmation received.")
        return

    # Validate formula by evaluating at a sample level
    try:
        sample_val = evaluate_formula(formula, 10)
    except Exception as e:
        await ctx.send(f"❌ Invalid formula: {e}")
        return

    # Store in guild settings
    db.update_guild_setting(ctx.guild.id, 'xp_formula', formula)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"✅ XP formula updated to: `{formula}`\nExample: `xp_for_level(10)` = {sample_val}")

# Slash wrappers for formula and setformula (admin-only)
@bot.tree.command(name='formula', description='Show the current XP formula for this server')
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def formula_slash(interaction: discord.Interaction):
    await _call_cmd_with_interaction(interaction, 'formula')

@bot.tree.command(name='setformula', description='Set a custom XP formula for this server')
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def setformula_slash(interaction: discord.Interaction, formula: str):
    # The prefix command expects formula as a single string after the *
    # We need to pass it as a positional arg, not kwarg
    await _call_cmd_with_interaction(interaction, 'setformula', formula, defer=True)

# helper: human readable seconds
def format_seconds(sec: int) -> str:
    sec = int(sec)
    h = sec // 3600
    m = (sec % 3600) // 60
    s = sec % 60
    parts = []
    if h:
        parts.append(f"{h}h")
    if m:
        parts.append(f"{m}m")
    if s or not parts:
        parts.append(f"{s}s")
    return " ".join(parts)

# -------------------------
# SEASON HELPER FUNCTIONS
# -------------------------
def get_current_season():
    """Get current season identifier (YYYY-MM format)"""
    now = datetime.now()
    return f"{now.year}-{now.month:02d}"

def get_season_name(season_id):
    """Convert season ID to readable name"""
    try:
        year, month = season_id.split('-')
        month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December']
        return f"{month_names[int(month)-1]} {year}"
    except:
        return season_id

def get_season_end_date():
    """Get when current season ends"""
    now = datetime.now()
    last_day = monthrange(now.year, now.month)[1]
    end_date = datetime(now.year, now.month, last_day, 23, 59, 59)
    return end_date

def get_time_until_season_end():
    """Get formatted time until season ends"""
    end_date = get_season_end_date()
    diff = end_date - datetime.now()
    
    days = diff.days
    hours = diff.seconds // 3600
    
    if days > 0:
        return f"{days} day{'s' if days != 1 else ''}, {hours} hour{'s' if hours != 1 else ''}"
    else:
        return f"{hours} hour{'s' if hours != 1 else ''}"

# -------------------------
# SLASH COMMAND WRAPPERS
# -------------------------
class InteractionContext:
    """Lightweight adapter to allow existing command callbacks to work with Interactions."""
    def __init__(self, interaction: discord.Interaction):
        self.interaction = interaction
        self.guild = interaction.guild
        self.author = interaction.user
        self.channel = interaction.channel

    async def send(self, *args, **kwargs):
        """Send message and RETURN the message object for reactions"""
        try:
            if not self.interaction.response.is_done():
                # Initial response - must use response.send_message
                await self.interaction.response.send_message(*args, **kwargs)
                # Get the original response message
                return await self.interaction.original_response()
            else:
                # Follow-up message - returns message directly
                return await self.interaction.followup.send(*args, **kwargs)
        except discord.errors.InteractionResponded:
            # Already responded, use followup
            try:
                return await self.interaction.followup.send(*args, **kwargs)
            except Exception as e:
                print(f"❌ Error in send followup: {e}")
                return None
        except Exception as e:
            print(f"❌ Error in send: {e}")
            return None

# Recent interactions cache to prevent duplicate processing (interaction.id -> timestamp)
_recent_interactions = {}
_INTERACTION_TTL = 10  # seconds

# Track processed interactions more aggressively
_processed_interactions = {}
_INTERACTION_DEDUPE_TTL = 30  # 30 seconds

async def defer_interaction(interaction: discord.Interaction):
    """Safely defer an interaction with improved error handling."""
    try:
        # Prefer an explicit expiry check where available
        try:
            if interaction.is_expired():
                print(f"⚠️ Interaction expired: {interaction.command.name if interaction.command else 'unknown'}")
                return False
        except Exception:
            # Some interaction objects may not expose is_expired reliably; ignore if it fails
            pass

        if not interaction.response.is_done():
            await interaction.response.defer()
            return True
        # Already acknowledged/processed
        return True
    except discord.errors.NotFound:
        # Interaction can't be acknowledged because it already expired
        print(f"⚠️ Interaction expired: {interaction.command.name if interaction.command else 'unknown'}")
        return False
    except discord.errors.InteractionResponded:
        # Already responded; treat as success
        return True
    except discord.errors.HTTPException as e:
        # HTTPException may indicate the interaction has already been acknowledged (40060)
        if 'already been acknowledged' in str(e).lower() or '40060' in str(e):
            return True
        print(f"❌ Defer error: {e}")
        return False
    except Exception as e:
        print(f"❌ Defer error: {e}")
        return False

async def _call_cmd_with_interaction(interaction: discord.Interaction, command_name: str, *args, defer: bool = False, **kwargs):
    """Helper to call existing prefix command callback from interaction."""
    
    # Check if interaction already expired
    try:
        if interaction.is_expired():
            print(f"⚠️ Interaction expired before processing: {command_name}")
            return
    except:
        pass
    
    # Only defer if explicitly requested (we now defer before calling this function)
    if defer:
        try:
            if not interaction.response.is_done():
                await interaction.response.defer()
        except discord.errors.InteractionResponded:
            # Already responded; nothing left to do
            return
        except discord.errors.NotFound:
            print(f"⚠️ Interaction 10062 (expired): {command_name}")
            return
        except discord.errors.HTTPException as e:
            # Some HTTP errors mean "already acknowledged" (40060); treat as success
            if 'already been acknowledged' in str(e).lower() or '40060' in str(e):
                return
            print(f"❌ Defer error: {e}")
            return
        except Exception as e:
            print(f"❌ Defer error: {e}")
            return
    
    # Now execute the command
    ctx = InteractionContext(interaction)
    cmd = bot.get_command(command_name)
    
    if cmd and hasattr(cmd, 'callback'):
        try:
            await cmd.callback(ctx, *args, **kwargs)
        except Exception as e:
            print(f"❌ Error executing {command_name}: {e}")
            try:
                await ctx.send(f"❌ Command error: {str(e)}")
            except:
                pass
    else:
        try:
            await ctx.send("❌ Command not found.")
        except:
            pass

# User-facing slash commands (mirror existing prefix commands)
@bot.tree.command(name="weekly", description="Weekly leaderboard: top XP gained in last 7 days")
async def weekly_slash(interaction: discord.Interaction, page: int = 1):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'weekly', page, defer=False)

@bot.tree.command(name="stats", description="Detailed stats for a user")
async def stats_slash(interaction: discord.Interaction, member: discord.Member = None):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'stats', member, defer=False)

@bot.tree.command(name="rewards", description="List rewards/role unlocks for ranks")
async def rewards_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'rewards', defer=False)

@bot.tree.command(name="voicetop", description="Voice leaderboard")
async def voicetop_slash(interaction: discord.Interaction, page: int = 1):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'voicetop', page, defer=False)

@bot.tree.command(name="compare", description="Compare your stats with another user")
async def compare_slash(interaction: discord.Interaction, member: discord.Member):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'compare', member, defer=False)

@bot.tree.command(name="xp", description="View your XP/level (or another user)")
async def xp_slash(interaction: discord.Interaction, member: discord.Member = None):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'xp', member, defer=False)

@bot.tree.command(name="leaderboard", description="View the server leaderboard")
async def leaderboard_slash(interaction: discord.Interaction, page: int = 1):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'leaderboard', page, defer=False)

@bot.tree.command(name="daily", description="Claim your daily XP reward")
async def daily_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'daily', defer=False)

@bot.tree.command(name="link", description="Check if your Discord account is linked to the web app")
async def link_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'link', defer=False)

@bot.tree.command(name="help_leveling", description="Show all leveling commands")
async def help_leveling_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'help_leveling', defer=False)

# Replace the chooseclass_slash command in bot.py

@bot.tree.command(name="chooseclass", description="Choose your hunter class (unlocks at level 10)")
async def chooseclass_slash(interaction: discord.Interaction):
    # Defer first to prevent timeout
    if not await defer_interaction(interaction):
        return
    
    # SPECIAL HANDLING: chooseclass needs reactions, so we DON'T use the wrapper
    # Instead, call the function directly with proper context
    
    # Ensure user exists FIRST
    user_data = db.get_user(interaction.user.id, interaction.guild.id)
    if not user_data:
        db.create_user(interaction.user.id, interaction.guild.id)
        await asyncio.sleep(0.1)
        user_data = db.get_user(interaction.user.id, interaction.guild.id)
    
    if not user_data:
        await interaction.followup.send("❌ Error creating user. Please try again.")
        return
    
    current_level = level_from_xp(user_data['xp'], interaction.guild.id)
    
    # Check if user is high enough level
    if current_level < CLASS_UNLOCK_LEVEL:
        await interaction.followup.send(
            f"❌ You need to reach **Level {CLASS_UNLOCK_LEVEL}** to choose a class!\n"
            f"Your current level: **{current_level}**"
        )
        return
    
    # Check if user already has a class
    current_class = db.get_user_class(interaction.user.id, interaction.guild.id)
    if current_class:
        await interaction.followup.send(
            f"❌ You've already chosen **{current_class}**!\n"
            f"Classes are permanent and cannot be changed."
        )
        return
    
    # Build the class selection embed
    embed = discord.Embed(
        title="🎮 CHOOSE YOUR HUNTER CLASS",
        description="Select your specialization. **This choice is permanent!**\n\nReact with the emoji to choose:",
        color=0xff6b6b
    )
    
    embed.add_field(
        name="🛡️ TANK - Endurance Specialist",
        value=(
            "• **1.8x Voice XP**\n"
            "• **50% faster cooldowns** (30s → 15s)\n"
            "• Trade-off: 0.9x Message XP\n"
            "*Best for: Voice chat lovers*"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🗡️ ASSASSIN - Precision Striker",
        value=(
            "• **1.5x Message XP**\n"
            "• **15% chance for 2x XP**\n"
            "• **Combo**: +5% per message (max 20%)\n"
            "• Trade-off: 0.8x Voice XP\n"
            "*Best for: Active chatters*"
        ),
        inline=False
    )
    
    embed.add_field(
        name="⚔️ FIGHTER - Balanced Warrior",
        value=(
            "• **1.2x All XP**\n"
            "• **Daily streak**: +5% per day (max 25%)\n"
            "• **Immune to spam penalty**\n"
            "*Best for: Consistent players*"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🏹 RANGER - Strategic Hunter",
        value=(
            "• **Pick 1 focus channel: 2x XP**\n"
            "• **Other channels: 0.8x XP**\n"
            "• Can change focus weekly\n"
            "*Best for: Strategic players*"
        ),
        inline=False
    )
    
    embed.add_field(
        name="💚 HEALER - Support Specialist",
        value=(
            "• **1.5x Daily rewards**\n"
            "• **+25 XP for @mentions** (5min cd)\n"
            "• **Voice aura**: +5% XP to everyone\n"
            "• Trade-off: 0.9x solo XP\n"
            "*Best for: Community supporters*"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🔮 MAGE - Knowledge Seeker",
        value=(
            "• **1.4x XP for long messages** (50+ chars)\n"
            "• **Store 3 dailies**, claim all (1.5x bonus)\n"
            "• Trade-off: 0.7x for short messages\n"
            "*Best for: Quality contributors*"
        ),
        inline=False
    )
    
    embed.set_footer(text="⚠️ This choice is PERMANENT! Choose wisely.")
    
    try:
        # Send message via followup (already deferred)
        msg = await interaction.followup.send(embed=embed, wait=True)
        
        if not msg:
            await interaction.followup.send("❌ Error displaying class selection. Please try again.")
            return
            
    except Exception as e:
        print(f"❌ Error sending class selection embed: {e}")
        await interaction.followup.send("❌ Error displaying class selection. Please try again.")
        return
    
    # Add reaction options
    reactions = ["🛡️", "🗡️", "⚔️", "🏹", "💚", "🔮"]
    
    try:
        for emoji in reactions:
            await msg.add_reaction(emoji)
            await asyncio.sleep(0.2)  # Rate limit protection
    except Exception as e:
        print(f"❌ Error adding reactions: {e}")
        await interaction.followup.send("❌ Error setting up class selection. Please try again.")
        return
    
    def check(reaction, user):
        return user == interaction.user and str(reaction.emoji) in reactions and reaction.message.id == msg.id
    
    try:
        reaction, user = await bot.wait_for('reaction_add', timeout=60.0, check=check)
        
        class_map = {
            "🛡️": "TANK",
            "🗡️": "ASSASSIN",
            "⚔️": "FIGHTER",
            "🏹": "RANGER",
            "💚": "HEALER",
            "🔮": "MAGE"
        }
        
        chosen_class = class_map[str(reaction.emoji)]
        
        # Set class in database
        db.set_user_class(interaction.user.id, interaction.guild.id, chosen_class)
        
        # Sync class to web app
        asyncio.create_task(db.sync_class_to_web(str(interaction.user.id), chosen_class))
        
        # Wait for DB write to complete
        await asyncio.sleep(0.15)
        
        # Give role
        role_id = get_class_roles(interaction.guild.id).get(chosen_class)
        if role_id and role_id != 0:
            role = interaction.guild.get_role(role_id)
            if role:
                try:
                    await interaction.user.add_roles(role, reason=f"Chose {chosen_class} class")
                except Exception as e:
                    print(f"❌ Error adding class role: {e}")
        
        await interaction.followup.send(
            f"✅ **CLASS SELECTED**\n"
            f"{interaction.user.mention} is now a **{str(reaction.emoji)} {chosen_class}**!\n"
            f"Your specialization is active. Good luck, hunter! 🎮"
        )
        
    except asyncio.TimeoutError:
        await interaction.followup.send("⏰ Class selection timed out. Use `/chooseclass` to try again.")
    except Exception as e:
        print(f"❌ Error in chooseclass: {e}")
        await interaction.followup.send("❌ Error selecting class. Please try again.")

@bot.tree.command(name="myclass", description="View your (or another user's) class")
async def myclass_slash(interaction: discord.Interaction, member: discord.Member = None):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'myclass', member, defer=False)

@bot.tree.command(name="setfocus", description="Set your focus channel (RANGER only)")
async def setfocus_slash(interaction: discord.Interaction, channel: discord.TextChannel):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'setfocus', channel, defer=False)

@bot.tree.command(name="claimstored", description="Claim stored daily rewards (MAGE only)")
async def claimstored_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'claimstored', defer=False)

@bot.tree.command(name="classinfo", description="View information about all classes")
async def classinfo_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'classinfo', defer=False)

@bot.tree.command(name="season", description="View current season & leaderboard")
async def season_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'season', defer=False)

@bot.tree.command(name="halloffame", description="View all past season winners")
async def halloffame_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'halloffame', defer=False)

# Admin / Manage commands (slash wrappers)
@bot.tree.command(name="serverstats", description="Show aggregated server stats")
@discord.app_commands.checks.has_permissions(administrator=True)
async def serverstats_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'serverstats', defer=False)

@bot.tree.command(name="dbcheck", description="Check database schema and column existence (Admin)")
@discord.app_commands.checks.has_permissions(administrator=True)
async def dbcheck_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    try:
        # Get the CREATE TABLE statement for 'users' table
        result = db._execute_query("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'", fetchone=True)
        if result:
            schema = result[0]
            # Get the actual columns
            col_result = db._execute_query("PRAGMA table_info(users)", fetchall=True)
            columns = [col[1] for col in col_result] if col_result else []
            
            embed = discord.Embed(title="Database Schema Check", color=0x00ff00)
            embed.add_field(name="Columns Found", value=f"{len(columns)} columns", inline=False)
            embed.add_field(name="Column List", value=", ".join(columns[:10]) + ("..." if len(columns) > 10 else ""), inline=False)
            
            # Check for critical columns
            critical = ['last_mention_xp', 'last_daily', 'daily_streak', 'stored_dailies', 'focus_channel', 'message_combo', 'last_message_time']
            missing = [c for c in critical if c not in columns]
            
            if missing:
                embed.add_field(name="Missing Columns (PROBLEM!)", value=", ".join(missing), inline=False)
                embed.color = 0xff0000
            else:
                embed.add_field(name="Critical Columns", value="All present ✓", inline=False)
            
            ctx = InteractionContext(interaction)
            await ctx.send(embed=embed)
        else:
            ctx = InteractionContext(interaction)
            await ctx.send("❌ Users table not found!")
    except Exception as e:
        ctx = InteractionContext(interaction)
        await ctx.send(f"❌ Error checking database: {e}")

@bot.tree.command(name="setxp", description="Set a user's XP (Admin)")
@discord.app_commands.checks.has_permissions(administrator=True)
async def setxp_slash(interaction: discord.Interaction, member: discord.Member, amount: str):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'setxp', member, amount, defer=False)

@bot.tree.command(name="addxp", description="Add XP to a user (Admin)")
@discord.app_commands.checks.has_permissions(administrator=True)
async def addxp_slash(interaction: discord.Interaction, member: discord.Member, amount: int):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'addxp', member, amount, defer=False)

@bot.tree.command(name="syncroles", description="Sync all users' roles based on rank (Admin)")
@discord.app_commands.checks.has_permissions(administrator=True)
async def syncroles_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'syncroles', defer=False)

@bot.tree.command(name="config", description="View current server configuration")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def config_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'config', defer=False)

@bot.tree.command(name="setxprange", description="Set the XP range for messages (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def setxprange_slash(interaction: discord.Interaction, min_xp: int, max_xp: int):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'setxprange', min_xp, max_xp, defer=False)

@bot.tree.command(name="setcooldown", description="Set the XP cooldown in seconds (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def setcooldown_slash(interaction: discord.Interaction, seconds: int):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'setcooldown', seconds, defer=False)

@bot.tree.command(name="togglevoicexp", description="Toggle voice XP on/off (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def togglevoicexp_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'togglevoicexp', defer=False)

@bot.tree.command(name="setvoicexp", description="Set voice XP per minute (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def setvoicexp_slash(interaction: discord.Interaction, xp_per_minute: int):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'setvoicexp', xp_per_minute, defer=False)

@bot.tree.command(name="toggledaily", description="Toggle daily rewards on/off (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def toggledaily_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'toggledaily', defer=False)

@bot.tree.command(name="setdaily", description="Set daily reward XP amount (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def setdaily_slash(interaction: discord.Interaction, xp_amount: int):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'setdaily', xp_amount, defer=False)

@bot.tree.command(name="blacklist", description="Blacklist a channel from giving XP (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def blacklist_slash(interaction: discord.Interaction, channel: discord.TextChannel):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'blacklist', channel, defer=False)

@bot.tree.command(name="unblacklist", description="Remove a channel from blacklist (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def unblacklist_slash(interaction: discord.Interaction, channel: discord.TextChannel):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'unblacklist', channel, defer=False)

@bot.tree.command(name="whitelist", description="Whitelist a channel (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def whitelist_slash(interaction: discord.Interaction, channel: discord.TextChannel):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'whitelist', channel, defer=False)

@bot.tree.command(name="unwhitelist", description="Remove a channel from whitelist (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def unwhitelist_slash(interaction: discord.Interaction, channel: discord.TextChannel):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'unwhitelist', channel, defer=False)

@bot.tree.command(name="clearwhitelist", description="Clear all whitelisted channels (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def clearwhitelist_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'clearwhitelist', defer=False)

@bot.tree.command(name="setmultiplier", description="Set an XP multiplier for a role (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def setmultiplier_slash(interaction: discord.Interaction, role: discord.Role, multiplier: float):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'setmultiplier', role, multiplier, defer=False)

@bot.tree.command(name="removemultiplier", description="Remove XP multiplier from a role (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def removemultiplier_slash(interaction: discord.Interaction, role: discord.Role):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'removemultiplier', role, defer=False)

@bot.tree.command(name="setlevelupchannel", description="Set a channel for level-up messages (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def setlevelupchannel_slash(interaction: discord.Interaction, channel: discord.TextChannel = None):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'setlevelupchannel', channel, defer=False)

@bot.tree.command(name="togglelevelup", description="Toggle level-up messages on/off (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def togglelevelup_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'togglelevelup', defer=False)

@bot.tree.command(name="endseason", description="Manually end current season (Admin)")
@discord.app_commands.checks.has_permissions(administrator=True)
async def endseason_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'endseason', defer=False)

@bot.tree.command(name="toggle_prefix_commands", description="Enable/disable legacy prefix commands for this server (Admin)")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def toggle_prefix_commands_slash(interaction: discord.Interaction, enabled: bool = None):
    if not await defer_interaction(interaction):
        return
    current = db.get_guild_settings(interaction.guild.id).get('prefix_commands_enabled', True)
    if enabled is None:
        new_state = not current
    else:
        new_state = bool(enabled)
    db.update_guild_setting(interaction.guild.id, 'prefix_commands_enabled', 1 if new_state else 0)
    ctx = InteractionContext(interaction)
    await ctx.send(f"✅ Prefix commands {'enabled' if new_state else 'disabled'}")

@bot.tree.command(name="help_config", description="Show all configuration commands")
@discord.app_commands.checks.has_permissions(manage_guild=True)
async def help_config_slash(interaction: discord.Interaction):
    if not await defer_interaction(interaction):
        return
    await _call_cmd_with_interaction(interaction, 'help_config', defer=False)

@bot.command()
@commands.has_permissions(manage_guild=True)
async def toggleprefix(ctx, enabled: bool = None):
    settings = db.get_guild_settings(ctx.guild.id)
    if enabled is None:
        new_state = not settings.get('prefix_commands_enabled', True)
    else:
        new_state = bool(enabled)
    db.update_guild_setting(ctx.guild.id, 'prefix_commands_enabled', 1 if new_state else 0)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"✅ Prefix commands {'enabled' if new_state else 'disabled'}")

# -------------------------
# VOICE & COMPARE COMMANDS
# -------------------------
@bot.command()
async def voicetop(ctx, page: int = 1):
    """Weekly leaderboard: top XP gained in last 7 days"""
    limit = 10
    offset = (page - 1) * limit

    rows = db.get_voice_leaderboard(ctx.guild.id, limit=100)
    if not rows:
        await ctx.send("No voice data yet. Join voice channels to record time!")
        return

    start = offset
    end = min(offset + limit, len(rows))
    page_data = rows[start:end]

    embed = discord.Embed(
        title="🎤 VOICE LEADERBOARD", 
        description=f"Top voice participants in **{ctx.guild.name}**", 
        color=0x00bfff
    )

    for i, (user_id, seconds) in enumerate(page_data, start=start+1):
        try:
            member = await ctx.guild.fetch_member(int(user_id))
            level = level_from_xp(db.get_user(member.id, ctx.guild.id)['xp'], ctx.guild.id)
            rank_str = rank_from_level(level)
            
            # Add medals for top 3
            medal = ""
            if i == 1:
                medal = "🥇 "
            elif i == 2:
                medal = "🥈 "
            elif i == 3:
                medal = "🥉 "
            
            embed.add_field(
                name=f"{medal}#{i} - {member.name}", 
                value=f"**{rank_str}** • Level {level} • {format_seconds(seconds)}", 
                inline=False
            )
        except:
            continue

    total_pages = (len(rows) + limit - 1) // limit
    embed.set_footer(text=f"Page {page}/{total_pages}")
    await ctx.send(embed=embed)

@bot.command()
async def compare(ctx, member: discord.Member):
    """Compare your stats with another user"""
    user_a = ctx.author
    user_b = member

    # ensure both users exist in DB
    for m in (user_a, user_b):
        if not db.get_user(m.id, ctx.guild.id):
            db.create_user(m.id, ctx.guild.id)

    a = db.get_user(user_a.id, ctx.guild.id)
    b = db.get_user(user_b.id, ctx.guild.id)

    a_xp = a['xp']; b_xp = b['xp']
    a_level = level_from_xp(a_xp, ctx.guild.id); b_level = level_from_xp(b_xp, ctx.guild.id)
    a_rank = rank_from_level(a_level); b_rank = rank_from_level(b_level)
    a_week = db.get_user_weekly_xp(user_a.id, ctx.guild.id); b_week = db.get_user_weekly_xp(user_b.id, ctx.guild.id)

    embed = discord.Embed(title=f"🔍 Compare: {user_a.name} vs {user_b.name}", color=0xffe066)
    embed.add_field(name=user_a.name, value=(f"Level {a_level}\n{a_rank}\n{a_xp:,} XP\nThis Week: {a_week:,} XP\nMsgs: {a.get('messages',0)}\nVoice: {format_seconds(a.get('voice_time',0))}"), inline=True)
    embed.add_field(name=user_b.name, value=(f"Level {b_level}\n{b_rank}\n{b_xp:,} XP\nThis Week: {b_week:,} XP\nMsgs: {b.get('messages',0)}\nVoice: {format_seconds(b.get('voice_time',0))}"), inline=True)

    # quick summary
    lead = []
    if a_xp > b_xp: lead.append(f"{user_a.name} leads in total XP")
    elif b_xp > a_xp: lead.append(f"{user_b.name} leads in total XP")
    if a_week > b_week: lead.append(f"{user_a.name} leads this week")
    elif b_week > a_week: lead.append(f"{user_b.name} leads this week")
    if a.get('messages',0) > b.get('messages',0): lead.append(f"{user_a.name} sent more messages")
    elif b.get('messages',0) > a.get('messages',0): lead.append(f"{user_b.name} sent more messages")
    if a.get('voice_time',0) > b.get('voice_time',0): lead.append(f"{user_a.name} spent more time in voice")
    elif b.get('voice_time',0) > a.get('voice_time',0): lead.append(f"{user_b.name} spent more time in voice")

    if lead:
        embed.add_field(name="Summary", value="\n".join(lead), inline=False)

    await ctx.send(embed=embed)

@bot.command()
@commands.has_permissions(administrator=True)
async def serverstats(ctx):
    """Show aggregated server stats"""
    ag = db.get_server_aggregates(ctx.guild.id)
    xp_list = db.get_all_user_xp(ctx.guild.id)
    avg_xp = int(sum(xp_list)/len(xp_list)) if xp_list else 0
    avg_level = sum(level_from_xp(x, ctx.guild.id) for x in xp_list) / len(xp_list) if xp_list else 0

    embed = discord.Embed(title=f"📈 Server Stats - {ctx.guild.name}", color=0x9b59b6)
    embed.add_field(name="Total Users (tracked)", value=str(ag['total_users']), inline=True)
    embed.add_field(name="Total Messages", value=f"{ag['total_messages']:,}", inline=True)
    embed.add_field(name="Total XP", value=f"{ag['total_xp']:,}", inline=True)
    embed.add_field(name="Total Voice Time", value=f"{format_seconds(ag['total_voice_time'])}", inline=True)
    embed.add_field(name="Average XP per User", value=f"{avg_xp:,}", inline=True)
    embed.add_field(name="Average Level", value=f"{avg_level:.2f}", inline=True)

    await ctx.send(embed=embed)

# -------------------------
# SEASON COMMANDS
# -------------------------
@bot.command()
async def season(ctx):
    """View current season info and leaderboard"""
    current_season = get_current_season()
    season_name = get_season_name(current_season)
    time_left = get_time_until_season_end()
    
    season_data = db.get_season_leaderboard(ctx.guild.id, current_season, limit=10)
    
    embed = discord.Embed(
        title=f"🏆 SEASON: {season_name}",
        description=f"Compete for the top spot! Season ends in **{time_left}**",
        color=0xffd700
    )
    
    if season_data:
        leaderboard_text = []
        for i, (user_id, xp) in enumerate(season_data, 1):
            try:
                member = await ctx.guild.fetch_member(int(user_id))
                medal = ""
                if i == 1:
                    medal = "🥇 "
                elif i == 2:
                    medal = "🥈 "
                elif i == 3:
                    medal = "🥉 "
                
                leaderboard_text.append(f"{medal}**#{i}** {member.name} - {xp:,} XP")
            except:
                continue
        
        if leaderboard_text:
            embed.add_field(
                name="📊 Current Season Standings",
                value="\n".join(leaderboard_text),
                inline=False
            )
    else:
        embed.add_field(
            name="📊 Current Season Standings",
            value="No data yet. Start earning XP to compete!",
            inline=False
        )
    
    past_winners = db.get_season_winners(ctx.guild.id, limit=3)
    if past_winners:
        winner_text = []
        for season_id, winners_json in past_winners:
            season_name_past = get_season_name(season_id)
            try:
                winners = json.loads(winners_json) if isinstance(winners_json, str) else winners_json
                winner_names = []
                for user_id in winners[:3]:
                    try:
                        member = await ctx.guild.fetch_member(int(user_id))
                        winner_names.append(member.name)
                    except:
                        continue
                if winner_names:
                    winner_text.append(f"**{season_name_past}**: {', '.join(winner_names)}")
            except:
                continue
        
        if winner_text:
            embed.add_field(
                name="🏅 Hall of Fame (Recent Winners)",
                value="\n".join(winner_text[:3]),
                inline=False
            )
    
    embed.set_footer(text="💡 Top 3 players get Season Champion role at the end!")
    await ctx.send(embed=embed)

@bot.command()
async def halloffame(ctx):
    """View all past season winners"""
    past_winners = db.get_season_winners(ctx.guild.id, limit=12)
    
    if not past_winners:
        await ctx.send("No past seasons yet. Be the first Season Champion!")
        return
    
    embed = discord.Embed(
        title="🏆 HALL OF FAME",
        description="Legendary Season Champions",
        color=0xffd700
    )
    
    for season_id, winners_json in past_winners:
        season_name_past = get_season_name(season_id)
        try:
            winners = json.loads(winners_json) if isinstance(winners_json, str) else winners_json
            winner_names = []
            for i, user_id in enumerate(winners[:3], 1):
                try:
                    member = await ctx.guild.fetch_member(int(user_id))
                    medal = ["🥇", "🥈", "🥉"][i-1]
                    winner_names.append(f"{medal} {member.name}")
                except:
                    continue
            
            if winner_names:
                embed.add_field(
                    name=f"📅 {season_name_past}",
                    value="\n".join(winner_names),
                    inline=True
                )
        except:
            continue
    
    if len(embed.fields) == 0:
        embed.description = "No past winners recorded yet."
    
    await ctx.send(embed=embed)

@bot.command()
@commands.has_permissions(administrator=True)
async def endseason(ctx):
    """Manually end current season and award champions (Admin only)"""
    await ctx.send("⏳ Ending current season and awarding champions...")
    
    result = await end_current_season(ctx.guild)
    await ctx.send(result)

async def end_current_season(guild):
    """End season, save winners, award roles, reset monthly XP"""
    current_season = get_current_season()
    
    # Get top 3 players BEFORE resetting
    top_players = db.get_season_leaderboard(guild.id, current_season, limit=3)
    
    if not top_players:
        return "❌ No data for current season. Nothing to end."
    
    # Save winners to database
    winner_ids = [str(user_id) for user_id, _ in top_players]
    db.save_season_winners(guild.id, current_season, winner_ids)
    
    # Award Season Champion role
    awarded = []
    role = None
    if SEASON_CHAMPION_ROLE:
        role = guild.get_role(SEASON_CHAMPION_ROLE)
        if not role:
            print(f"❌ Season Champion role not found! ID: {SEASON_CHAMPION_ROLE}")
        else:
            # Remove role from everyone first
            for member in guild.members:
                if role in member.roles:
                    try:
                        await member.remove_roles(role, reason="Season ended")
                        print(f"Removed Season Champion from {member.name}")
                    except Exception as e:
                        print(f"Failed to remove role from {member.name}: {e}")
            
            # Award to top 3
            for user_id, xp in top_players:
                try:
                    member = await guild.fetch_member(int(user_id))
                    await member.add_roles(role, reason=f"Season Champion - {get_season_name(current_season)}")
                    awarded.append(member.name)
                    print(f"✅ Awarded Season Champion to {member.name}")
                    await asyncio.sleep(0.5)  # Rate limit protection
                except discord.NotFound:
                    print(f"❌ Member {user_id} not found")
                    continue
                except discord.Forbidden:
                    print(f"❌ No permission to add role to {user_id}")
                    continue
                except Exception as e:
                    print(f"❌ Error awarding role to {user_id}: {e}")
                    continue
    
    # NOW reset the season data (this clears monthly XP)
    db.reset_season(guild.id)
    print(f"✅ Season {current_season} reset in database")
    
    # Build announcement
    season_name = get_season_name(current_season)
    winner_text = []
    for i, (user_id, xp) in enumerate(top_players, 1):
        try:
            member = await guild.fetch_member(int(user_id))
            medal = ["🥇", "🥈", "🥉"][i-1]
            winner_text.append(f"{medal} {member.mention} - {xp:,} XP")
        except:
            continue
    
    role_status = ""
    if role and awarded:
        role_status = f"\n✅ Season Champion role awarded to: {', '.join(awarded)}"
    elif role:
        role_status = "\n⚠️ Role exists but couldn't award to winners"
    else:
        role_status = "\n⚠️ Season Champion role not found - check role ID"
    
    announcement = (
        f"🏆 **SEASON ENDED: {season_name}**\n\n"
        f"**Champions:**\n" + "\n".join(winner_text) + 
        role_status + "\n\n"
        f"New season begins now. Good luck! 🔥"
    )
    
    return announcement

# -------------------------
# COMMANDS
# -------------------------

# -------------------------
# XP COMMAND - ALWAYS CUSTOM CARD
# -------------------------
@bot.command(aliases=['level', 'rank', 'profile'])
async def xp(ctx, member: discord.Member = None):
    """Check your XP, level, and rank (shows web app data if linked)"""
    member = member or ctx.author
    
    # First check if user is linked to web app
    web_user = get_web_app_user(member.id)
    
    if web_user:
        # User is linked - show web app data
        total_xp = web_user['total_xp']
        level = web_user['level']
        rank_str = web_user['rank']

        # Calculate XP progress (web app formula: level * 100)
        if level <= 1:
            # Level 0-1: Simple case
            current_level_xp = total_xp
            next_level_xp = 100 if level == 0 else 200
        else:
            # Calculate total XP needed to reach current level
            # Formula: 100 + 200 + 300 + ... + (level * 100)
            xp_at_current_level = sum(l * 100 for l in range(1, level + 1))

            # XP needed for next level
            next_level_xp = (level + 1) * 100

            # XP progress within current level
            current_level_xp = total_xp - xp_at_current_level

            # Safety check: if negative, something's wrong - reset to 0
            if current_level_xp < 0:
                print(f"Warning: Negative XP for level {level}, total_xp={total_xp}, xp_at_level={xp_at_current_level}")
                current_level_xp = 0
        
        try:
            avatar_url = member.avatar.url if member.avatar else member.default_avatar.url
            display_name = web_user['hunter_name'][:20]
            
            # DEBUG: Print what we're sending to card generator
            print(f"🎨 Sending to card generator (WEB USER):")
            print(f"   Level: {level}")
            print(f"   Total XP: {total_xp}")
            print(f"   Current Level XP: {current_level_xp}")
            print(f"   Next Level XP: {next_level_xp}")

            card_path = create_rank_card(
                username=display_name,
                avatar_url=avatar_url,
                level=level,
                rank_name=rank_str,
                server_rank=1,  # Web app user - show as #1
                current_xp=current_level_xp,
                needed_xp=next_level_xp,
                total_xp=total_xp
            )
            
            if card_path:
                embed = discord.Embed(
                    description="🌐 **Synced with Web App**",
                    color=0x00ff00
                )
                await ctx.send(embed=embed, file=discord.File(card_path))
                os.remove(card_path)
            else:
                await ctx.send("❌ Error generating rank card.")
        except Exception as e:
            print(f"Error generating rank card: {e}")
            await ctx.send(f"❌ Error: {str(e)}")
    else:
        # User not linked - show Discord bot data (old system)
        user_data = db.get_user(member.id, ctx.guild.id)
        if not user_data:
            db.create_user(member.id, ctx.guild.id)
            user_data = db.get_user(member.id, ctx.guild.id)

        total_xp = user_data['xp']
        level = level_from_xp(total_xp, ctx.guild.id)
        rank_str = rank_from_level(level)
        server_rank = db.get_rank(member.id, ctx.guild.id)

        # Calculate XP progress (web app formula: level * 100)
        if level <= 1:
            current_level_xp = total_xp
            next_level_xp = 100 if level == 0 else 200
        else:
            xp_at_current_level = sum(l * 100 for l in range(1, level + 1))
            next_level_xp = (level + 1) * 100
            current_level_xp = total_xp - xp_at_current_level

            if current_level_xp < 0:
                print(f"Warning: Negative XP for level {level}, total_xp={total_xp}, xp_at_level={xp_at_current_level}")
                current_level_xp = 0
    
        try:
            avatar_url = member.avatar.url if member.avatar else member.default_avatar.url
            display_name = member.name[:20]
            
            # DEBUG: Print what we're sending to card generator
            print(f"🎨 Sending to card generator (DISCORD USER):")
            print(f"   Level: {level}")
            print(f"   Total XP: {total_xp}")
            print(f"   Current Level XP: {current_level_xp}")
            print(f"   Next Level XP: {next_level_xp}")
            
            card_path = create_rank_card(
                username=display_name,
                avatar_url=avatar_url,
                level=level,
                rank_name=rank_str,
                server_rank=server_rank,
                current_xp=current_level_xp,
                needed_xp=next_level_xp,
                total_xp=total_xp
            )
            
            if card_path:
                embed = discord.Embed(
                    description="💬 **Discord XP Only** - Link your account for full stats!",
                    color=0xffa500
                )
                embed.set_footer(text="Use /link to connect your web app account")
                await ctx.send(embed=embed, file=discord.File(card_path))
                os.remove(card_path)
            else:
                await ctx.send("❌ Error generating rank card.")
        except Exception as e:
            print(f"Error generating rank card: {e}")
            await ctx.send(f"❌ Error: {str(e)}")

@bot.command(aliases=['lb', 'top'])
async def leaderboard(ctx, page: int = 1):
    """View the server leaderboard"""
    limit = 10
    offset = (page - 1) * limit
    
    leaderboard = db.get_leaderboard(ctx.guild.id, limit=100)
    
    if not leaderboard:
        await ctx.send("No data yet. Start chatting to earn XP!")
        return
    
    # Paginate
    start = offset
    end = min(offset + limit, len(leaderboard))
    page_data = leaderboard[start:end]
    
    embed = discord.Embed(
        title="🏆 HUNTER LEADERBOARD",
        description=f"Top hunters in **{ctx.guild.name}**",
        color=0xffd700
    )
    
    for i, (user_id, xp, msgs) in enumerate(page_data, start=start+1):
        try:
            member = await ctx.guild.fetch_member(int(user_id))
            level = await asyncio.to_thread(
                safe_level_from_xp,
                xp,
                ctx.guild.id
            )

            rank_str = rank_from_level(level)
            
            medal = ""
            if i == 1:
                medal = "🥇 "
            elif i == 2:
                medal = "🥈 "
            elif i == 3:
                medal = "🥉 "
            
            embed.add_field(
                name=f"{medal}#{i} - {member.name}",
                value=f"**{rank_str}** • Level {level} • {xp:,} XP",
                inline=False
            )
        except:
            continue
    
    total_pages = (len(leaderboard) + limit - 1) // limit
    embed.set_footer(text=f"Page {page}/{total_pages}")
    
    await ctx.send(embed=embed)

@bot.command()
async def daily(ctx):
    """Claim your daily XP reward (scales with level)"""
    user_data = db.get_user(ctx.author.id, ctx.guild.id)
    if not user_data:
        db.create_user(ctx.author.id, ctx.guild.id)
        user_data = db.get_user(ctx.author.id, ctx.guild.id)
    
    # Calculate dynamic daily reward based on level
    current_level = level_from_xp(user_data['xp'], ctx.guild.id)
    daily_reward = int(0.2 * ((current_level * 150) + 50))
    
    # Apply class bonuses
    user_class = db.get_user_class(ctx.author.id, ctx.guild.id)
    
    if user_class == "FIGHTER":
        daily_reward = int(daily_reward * 1.2)
    elif user_class == "HEALER":
        daily_reward = int(daily_reward * 1.5)
    elif user_class == "MAGE":
        daily_reward = int(daily_reward * 1.5)
        # MAGE stores dailies instead of claiming
        if db.add_stored_daily(ctx.author.id, ctx.guild.id):
            user_data = db.get_user(ctx.author.id, ctx.guild.id)
            stored = user_data.get('stored_dailies', 0)
            
            # Update last_daily timestamp
            try:
                db.set_last_daily(ctx.author.id, ctx.guild.id)
            except Exception as e:
                print(f"Warning: failed to set last_daily for {ctx.author.id}: {e}")
            await ctx.send(
                f"🔮 **MANA STORED**\n"
                f"{ctx.author.mention} stored **{daily_reward:,} XP**!\n"
                f"*Stored dailies: {stored}/3*\n"
                f"Use `!claimstored` to claim all at once (1.5x bonus)!"
            )
            return
        else:
            await ctx.send("❌ You already have 3 stored dailies! Use `!claimstored` first.")
            return
    
    success, result = db.claim_daily(ctx.author.id, ctx.guild.id, daily_reward)
    
    if success:
        # Sync daily XP to web app
        asyncio.create_task(db.sync_xp_to_web(str(ctx.author.id), result, "discord_daily"))
        
        await ctx.send(
            f"🎁 **DAILY REWARD**\n"
            f"{ctx.author.mention} claimed **{result:,} XP**!\n"
            f"*Reward scales with your level ({current_level})*\n"
            f"Come back in 24 hours for more."
        )
    else:
        await ctx.send(
            f"⏰ **COOLDOWN ACTIVE**\n"
            f"You can claim your daily reward in **{result}**"
        )

@bot.command()
@commands.has_permissions(administrator=True)
async def setxp(ctx, member: discord.Member, amount: str):
    """Set a user's XP (Admin only)"""
    amount = int(amount.replace(",", ""))
    
    user_data = db.get_user(member.id, ctx.guild.id)
    if not user_data:
        db.create_user(member.id, ctx.guild.id)
        user_data = db.get_user(member.id, ctx.guild.id)

    old_level = level_from_xp(user_data['xp'], ctx.guild.id)
    old_rank = rank_from_level(old_level)

    db.set_xp(member.id, ctx.guild.id, amount)

    new_level = level_from_xp(amount, ctx.guild.id)
    new_rank = rank_from_level(new_level)

    # Update roles immediately
    await update_rank_roles(member, new_rank)

    await ctx.send(
        f"🔮 **SYSTEM OVERRIDE**\n"
        f"XP set to **{amount:,}** for {member.mention}\n"
        f"Level: **{new_level}**\n"
        f"Rank: **{new_rank}**"
    )

    # Show rank ascension if rank changed; reuse handler for consistent behavior (images + fallback)
    if old_rank != new_rank:
        try:
            # Force announcement when an admin directly sets XP
            await handle_levelup(member, member.guild, ctx.channel, old_level, new_level, force=True)
        except Exception as e:
            print(f"Error handling levelup after setxp: {e}")

@bot.command()
@commands.has_permissions(administrator=True)
async def addxp(ctx, member: discord.Member, amount: int):
    """Add XP to a user (Admin only)"""
    user_data = db.get_user(member.id, ctx.guild.id)
    if not user_data:
        db.create_user(member.id, ctx.guild.id)
        user_data = db.get_user(member.id, ctx.guild.id)

    old_level = level_from_xp(user_data['xp'], ctx.guild.id)
    old_rank = rank_from_level(old_level)

    db.add_xp(member.id, ctx.guild.id, amount)
    
    # Sync admin-added XP to web app
    asyncio.create_task(db.sync_xp_to_web(str(member.id), amount, "discord_admin"))

    new_data = db.get_user(member.id, ctx.guild.id)
    new_level = level_from_xp(new_data['xp'], ctx.guild.id)
    new_rank = rank_from_level(new_level)

    await ctx.send(
        f"✅ Added **{amount:,} XP** to {member.mention}"
    )

    # Show rank ascension if rank changed
    if old_rank != new_rank:
        try:
            # Reuse existing handler to keep behavior consistent (images + fallback + role updates)
            # Force announcement for admin-initiated XP changes
            await handle_levelup(member, member.guild, ctx.channel, old_level, new_level, force=True)
        except Exception as e:
            print(f"Error handling levelup after addxp: {e}")

@bot.command()
async def help_leveling(ctx):
    """Show all leveling commands"""
    embed = discord.Embed(
        title="🔮 SYSTEM COMMANDS",
        description="All available hunter commands",
        color=0x00d4ff
    )
    
    embed.add_field(
        name="👤 User Commands",
        value=(
            "`/xp [@user]` - View XP and rank\n"
            "`/leaderboard [page]` - View top hunters\n"
            "`/weekly [page]` - Weekly XP leaderboard\n"
            "`/voicetop [page]` - Voice time leaderboard\n"
            "`/stats [@user]` - Detailed user stats\n"
            "`/compare @user` - Compare stats with someone\n"
            "`/season` - View current season & leaderboard\n"
            "`/halloffame` - View past season champions\n"
            "`/daily` - Claim daily XP reward\n"
            "`/rewards` - View rewards & role unlocks"
        ),
        inline=False
    )
    
    embed.add_field(
        name="👤 User Commands",
        value=(
            "`/xp [@user]` - View XP and rank\n"
            "`/leaderboard [page]` - View top hunters\n"
            "`/weekly [page]` - Weekly XP leaderboard\n"
            "`/voicetop [page]` - Voice time leaderboard\n"
            "`/stats [@user]` - Detailed user stats\n"
            "`/compare @user` - Compare stats with someone\n"
            "`/season` - View current season & leaderboard\n"
            "`/halloffame` - View past season champions\n"
            "`/daily` - Claim daily XP reward\n"
            "`/rewards` - View rewards & role unlocks"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🎮 Class System (Unlock at Lv10)",
        value=(
            "`/chooseclass` - Choose your class\n"
            "`/myclass [@user]` - View class info\n"
            "`/classinfo` - All classes info\n"
            "`/setfocus #channel` - Set focus (RANGER)\n"
            "`/claimstored` - Claim dailies (MAGE)"
        ),
        inline=False
    )
    
    embed.add_field(
        name="⚙️ Admin Commands",
        value=(
            "`/setxp @user <amount>` - Set user XP\n"
            "`/addxp @user <amount>` - Add XP to user\n"
            "`/serverstats` - View server analytics\n"  # NEW
            "`/config` - View/edit server settings\n"
            "`/help_config` - See all config commands\n"
            "`/formula` - Show current XP formula (admin-only)\n"
            "`/setformula <formula>` - Set custom XP formula (admin-only)"
        ),
        inline=False
    )
    
    embed.add_field(
        name="📊 XP Sources",
        value=(
            "💬 **Messages**: 15-25 XP (1min cooldown)\n"
            "🎤 **Voice**: 5 XP per minute\n"
            "🎁 **Daily**: XP Rewards every 24h"
        ),
        inline=False
    )
    
    await ctx.send(embed=embed)



@bot.command()
@commands.has_permissions(administrator=True)
async def syncroles(ctx):
    """Sync all users' roles based on their current rank (Admin only)"""
    await ctx.send("🔄 Syncing roles for all users...")
    
    synced = 0
    errors = 0
    
    # Get all users in database for this guild
    users = db.get_all_users_in_guild(ctx.guild.id)
    
    for user_id, xp in users:
        try:
            member = await ctx.guild.fetch_member(int(user_id))
            level = level_from_xp(xp, ctx.guild.id)
            rank = rank_from_level(level)
            
            if await update_rank_roles(member, rank):
                synced += 1
        except:
            errors += 1
            continue
    
    await ctx.send(
        f"✅ **Role Sync Complete**\n"
        f"✓ Synced: {synced} users\n"
        f"✗ Errors: {errors} users"
    )

def clear_guild_cache(guild_id):
    """Clear cached settings when admin changes them"""
    cache_key = str(guild_id)
    if cache_key in _guild_settings_cache:
        del _guild_settings_cache[cache_key]
        print(f"Cleared cache for guild {guild_id}")

# -------------------------
# ADMIN CONFIGURATION COMMANDS
# Add these to bot.py after your existing commands
# -------------------------

@bot.command()
@commands.has_permissions(manage_guild=True)
async def config(ctx):
    """View current server configuration"""
    settings = db.get_guild_settings(ctx.guild.id)
    
    embed = discord.Embed(
        title="⚙️ SERVER CONFIGURATION",
        description=f"Settings for **{ctx.guild.name}**",
        color=0x00d4ff
    )
    
    # XP Settings
    embed.add_field(
        name="💬 Message XP",
        value=f"Range: **{settings['xp_min']}-{settings['xp_max']} XP**\nCooldown: **{settings['xp_cooldown']}s**",
        inline=True
    )
    
    # Voice XP
    voice_status = "✅ Enabled" if settings['voice_xp_enabled'] else "❌ Disabled"
    embed.add_field(
        name="🎤 Voice XP",
        value=f"{voice_status}\nRate: **{settings['voice_xp_rate']} XP/min**",
        inline=True
    )
    
    # Daily
    daily_status = "✅ Enabled" if settings['daily_enabled'] else "❌ Disabled"
    embed.add_field(
        name="🎁 Daily Reward",
        value=f"{daily_status}\nReward: **Scales with level**\n*Formula: 0.2 × [(level × 150) + 50]*",
        inline=True
    )
    
    # Level-up messages
    levelup_status = "✅ Enabled" if settings['levelup_messages'] else "❌ Disabled"
    levelup_ch = f"<#{settings['levelup_channel']}>" if settings['levelup_channel'] else "Same channel"
    embed.add_field(
        name="📢 Level-Up Messages",
        value=f"{levelup_status}\nChannel: {levelup_ch}",
        inline=False
    )
    
    # Blacklisted channels
    if settings['blacklisted_channels']:
        blacklist_str = ", ".join([f"<#{ch}>" for ch in settings['blacklisted_channels'][:5]])
        if len(settings['blacklisted_channels']) > 5:
            blacklist_str += f" +{len(settings['blacklisted_channels']) - 5} more"
        embed.add_field(name="🚫 Blacklisted Channels", value=blacklist_str, inline=False)
    
    # Whitelisted channels
    if settings['whitelisted_channels']:
        whitelist_str = ", ".join([f"<#{ch}>" for ch in settings['whitelisted_channels'][:5]])
        if len(settings['whitelisted_channels']) > 5:
            whitelist_str += f" +{len(settings['whitelisted_channels']) - 5} more"
        embed.add_field(name="✅ Whitelisted Channels", value=whitelist_str, inline=False)
    
    # Role multipliers
    if settings['role_multipliers']:
        mult_list = []
        for role_id, mult in list(settings['role_multipliers'].items())[:5]:
            mult_list.append(f"<@&{role_id}>: **{mult}x**")
        mult_str = "\n".join(mult_list)
        if len(settings['role_multipliers']) > 5:
            mult_str += f"\n+{len(settings['role_multipliers']) - 5} more"
        embed.add_field(name="⚡ Role Multipliers", value=mult_str, inline=False)
    
    embed.set_footer(text="Use /help_config to see all configuration commands")
    await ctx.send(embed=embed)

@bot.command()
@commands.has_permissions(manage_guild=True)
async def setxprange(ctx, min_xp: int, max_xp: int):
    """Set the XP range for messages (Admin only)"""
    if min_xp < 1 or max_xp < min_xp or max_xp > 100:
        await ctx.send("❌ Invalid range! Min must be ≥1, Max must be ≥Min and ≤100")
        return
    
    db.update_guild_setting(ctx.guild.id, 'xp_min', min_xp)
    db.update_guild_setting(ctx.guild.id, 'xp_max', max_xp)
    
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    
    await ctx.send(f"✅ XP range set to **{min_xp}-{max_xp} XP** per message")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def setcooldown(ctx, seconds: int):
    """Set the XP cooldown in seconds (Admin only)"""
    if seconds < 0 or seconds > 300:
        await ctx.send("❌ Cooldown must be between 0 and 300 seconds")
        return
    
    db.update_guild_setting(ctx.guild.id, 'xp_cooldown', seconds)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"✅ XP cooldown set to **{seconds} seconds**")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def togglevoicexp(ctx):
    """Toggle voice XP on/off (Admin only)"""
    settings = db.get_guild_settings(ctx.guild.id)
    new_state = not settings['voice_xp_enabled']
    
    db.update_guild_setting(ctx.guild.id, 'voice_xp_enabled', 1 if new_state else 0)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    status = "✅ Enabled" if new_state else "❌ Disabled"
    await ctx.send(f"{status} voice XP")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def setvoicexp(ctx, xp_per_minute: int):
    """Set voice XP rate per minute (Admin only)"""
    if xp_per_minute < 0 or xp_per_minute > 50:
        await ctx.send("❌ Voice XP must be between 0 and 50 per minute")
        return
    db.update_guild_setting(ctx.guild.id, 'voice_xp_rate', xp_per_minute)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"✅ Voice XP set to **{xp_per_minute} XP per minute**")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def toggledaily(ctx):
    """Toggle daily rewards on/off (Admin only)"""
    settings = db.get_guild_settings(ctx.guild.id)
    new_state = not settings['daily_enabled']
    
    db.update_guild_setting(ctx.guild.id, 'daily_enabled', 1 if new_state else 0)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    status = "✅ Enabled" if new_state else "❌ Disabled"
    await ctx.send(f"{status} daily rewards")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def setdaily(ctx, xp_amount: int):
    """Set daily reward XP amount (Admin only)"""
    if xp_amount < 0 or xp_amount > 10000:
        await ctx.send("❌ Daily XP must be between 0 and 10,000")
        return
    
    db.update_guild_setting(ctx.guild.id, 'daily_reward', xp_amount)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"✅ Daily reward set to **{xp_amount:,} XP**")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def blacklist(ctx, channel: discord.TextChannel):
    """Blacklist a channel from giving XP (Admin only)"""
    db.add_blacklisted_channel(ctx.guild.id, channel.id)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"🚫 {channel.mention} will no longer give XP")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def unblacklist(ctx, channel: discord.TextChannel):
    """Remove a channel from blacklist (Admin only)"""
    db.remove_blacklisted_channel(ctx.guild.id, channel.id)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"✅ {channel.mention} can now give XP")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def whitelist(ctx, channel: discord.TextChannel):
    """Whitelist a channel (only whitelisted channels give XP) (Admin only)"""
    db.add_whitelisted_channel(ctx.guild.id, channel.id)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"✅ {channel.mention} added to whitelist. Only whitelisted channels will give XP.")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def unwhitelist(ctx, channel: discord.TextChannel):
    """Remove a channel from whitelist (Admin only)"""
    db.remove_whitelisted_channel(ctx.guild.id, channel.id)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"❌ {channel.mention} removed from whitelist")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def clearwhitelist(ctx):
    """Clear all whitelisted channels (Admin only)"""
    db.update_guild_setting(ctx.guild.id, 'whitelisted_channels', [])
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send("✅ Whitelist cleared. All channels can now give XP (except blacklisted)")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def setmultiplier(ctx, role: discord.Role, multiplier: float):
    """Set an XP multiplier for a role (Admin only)"""
    if multiplier < 0.1 or multiplier > 10:
        await ctx.send("❌ Multiplier must be between 0.1x and 10x")
        return
    
    db.set_role_multiplier(ctx.guild.id, role.id, multiplier)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"⚡ {role.mention} now has **{multiplier}x** XP multiplier")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def removemultiplier(ctx, role: discord.Role):
    """Remove XP multiplier from a role (Admin only)"""
    db.remove_role_multiplier(ctx.guild.id, role.id)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    await ctx.send(f"❌ Removed XP multiplier from {role.mention}")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def setlevelupchannel(ctx, channel: discord.TextChannel = None):
    """Set a specific channel for level-up messages (Admin only)"""
    if channel:
        db.update_guild_setting(ctx.guild.id, 'levelup_channel', str(channel.id))
        clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
        await ctx.send(f"📢 Level-up messages will now be sent to {channel.mention}")
    else:
        db.update_guild_setting(ctx.guild.id, 'levelup_channel', None)
        clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
        await ctx.send("📢 Level-up messages will be sent in the same channel as the user")

@bot.command()
@commands.has_permissions(manage_guild=True)
async def togglelevelup(ctx):
    """Toggle level-up messages on/off (Admin only)"""
    settings = db.get_guild_settings(ctx.guild.id)
    new_state = not settings['levelup_messages']
    
    db.update_guild_setting(ctx.guild.id, 'levelup_messages', 1 if new_state else 0)
    clear_guild_cache(ctx.guild.id)  # ← ADD THIS LINE
    status = "✅ Enabled" if new_state else "❌ Disabled"
    await ctx.send(f"{status} level-up messages")

@bot.command()
async def help_config(ctx):
    """Show all configuration commands"""
    embed = discord.Embed(
        title="⚙️ CONFIGURATION COMMANDS",
        description="Admin commands to configure the leveling system",
        color=0x00d4ff
    )
    
    embed.add_field(
        name="📊 View Settings",
        value="`/config` - View current configuration",
        inline=False
    )
    
    embed.add_field(
        name="💬 Message XP",
        value=(
            "`/setxprange <min> <max>` - Set XP range\n"
            "`/setcooldown <seconds>` - Set XP cooldown"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🎤 Voice XP",
        value=(
            "`/togglevoicexp` - Enable/disable voice XP\n"
            "`/setvoicexp <xp>` - Set XP per minute"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🎁 Daily Rewards",
        value=(
            "`/toggledaily` - Enable/disable daily rewards\n"
            "`/setdaily <xp>` - Set daily XP amount"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🚫 Channel Control",
        value=(
            "`/blacklist #channel` - Block XP in channel\n"
            "`/unblacklist #channel` - Allow XP in channel\n"
            "`/whitelist #channel` - Only whitelisted give XP\n"
            "`/unwhitelist #channel` - Remove from whitelist\n"
            "`/clearwhitelist` - Clear all whitelisted"
        ),
        inline=False
    )
    
    embed.add_field(
        name="⚡ Role Multipliers",
        value=(
            "`/setmultiplier @role <multiplier>` - Set role XP boost\n"
            "`/removemultiplier @role` - Remove boost"
        ),
        inline=False
    )
    
    embed.add_field(
        name="📢 Level-Up Messages",
        value=(
            "`/togglelevelup` - Enable/disable messages\n"
            "`/setlevelupchannel #channel` - Set specific channel"
        ),
        inline=False
    )
    
    embed.set_footer(text="💡 All commands require Manage Server permission")
    await ctx.send(embed=embed)

# -------------------------
# CLASS SYSTEM COMMANDS
# -------------------------

@bot.command()
async def chooseclass(ctx):
    """Choose your hunter class (unlocks at level 10)"""
    # Ensure user exists FIRST
    user_data = db.get_user(ctx.author.id, ctx.guild.id)
    if not user_data:
        db.create_user(ctx.author.id, ctx.guild.id)
        await asyncio.sleep(0.1)  # Wait for DB write to complete
        user_data = db.get_user(ctx.author.id, ctx.guild.id)
    
    if not user_data:
        await ctx.send("❌ Error creating user. Please try again.")
        return
    
    current_level = level_from_xp(user_data['xp'], ctx.guild.id)
    
    # Check if user is high enough level
    if current_level < CLASS_UNLOCK_LEVEL:
        await ctx.send(f"❌ You need to reach **Level {CLASS_UNLOCK_LEVEL}** to choose a class!\nYour current level: **{current_level}**")
        return
    
    # Check if user already has a class
    current_class = db.get_user_class(ctx.author.id, ctx.guild.id)
    if current_class:
        await ctx.send(f"❌ You've already chosen **{current_class}**!\nClasses are permanent and cannot be changed.")
        return
    
    # Show class selection menu
    embed = discord.Embed(
        title="🎮 CHOOSE YOUR HUNTER CLASS",
        description="Select your specialization. **This choice is permanent!**\n\nReact with the emoji to choose:",
        color=0xff6b6b
    )
    
    embed.add_field(
        name="🛡️ TANK - Endurance Specialist",
        value=(
            "• **1.8x Voice XP**\n"
            "• **50% faster cooldowns** (30s → 15s)\n"
            "• Trade-off: 0.9x Message XP\n"
            "*Best for: Voice chat lovers*"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🗡️ ASSASSIN - Precision Striker",
        value=(
            "• **1.5x Message XP**\n"
            "• **15% chance for 2x XP**\n"
            "• **Combo**: +5% per message (max 20%)\n"
            "• Trade-off: 0.8x Voice XP\n"
            "*Best for: Active chatters*"
        ),
        inline=False
    )
    
    embed.add_field(
        name="⚔️ FIGHTER - Balanced Warrior",
        value=(
            "• **1.2x All XP**\n"
            "• **Daily streak**: +5% per day (max 25%)\n"
            "• **Immune to spam penalty**\n"
            "*Best for: Consistent players*"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🏹 RANGER - Strategic Hunter",
        value=(
            "• **Pick 1 focus channel: 2x XP**\n"
            "• **Other channels: 0.8x XP**\n"
            "• Can change focus weekly\n"
            "*Best for: Strategic players*"
        ),
        inline=False
    )
    
    embed.add_field(
        name="💚 HEALER - Support Specialist",
        value=(
            "• **1.5x Daily rewards**\n"
            "• **+25 XP for @mentions** (5min cd)\n"
            "• **Voice aura**: +5% XP to everyone\n"
            "• Trade-off: 0.9x solo XP\n"
            "*Best for: Community supporters*"
        ),
        inline=False
    )
    
    embed.add_field(
        name="🔮 MAGE - Knowledge Seeker",
        value=(
            "• **1.4x XP for long messages** (50+ chars)\n"
            "• **Store 3 dailies**, claim all (1.5x bonus)\n"
            "• Trade-off: 0.7x for short messages\n"
            "*Best for: Quality contributors*"
        ),
        inline=False
    )
    
    embed.set_footer(text="⚠️ This choice is PERMANENT! Choose wisely.")
    
    try:
        msg = await ctx.send(embed=embed)
    except Exception as e:
        print(f"❌ Error sending class selection embed: {e}")
        await ctx.send("❌ Error displaying class selection. Please try again.")
        return
    
    # Add reaction options
    reactions = ["🛡️", "🗡️", "⚔️", "🏹", "💚", "🔮"]
    
    try:
        for emoji in reactions:
            await msg.add_reaction(emoji)
            await asyncio.sleep(0.2)  # Rate limit protection
    except Exception as e:
        print(f"❌ Error adding reactions: {e}")
        await ctx.send("❌ Error setting up class selection. Please try again.")
        return
    
    def check(reaction, user):
        return user == ctx.author and str(reaction.emoji) in reactions and reaction.message.id == msg.id
    
    try:
        reaction, user = await bot.wait_for('reaction_add', timeout=60.0, check=check)
        
        class_map = {
            "🛡️": "TANK",
            "🗡️": "ASSASSIN",
            "⚔️": "FIGHTER",
            "🏹": "RANGER",
            "💚": "HEALER",
            "🔮": "MAGE"
        }
        
        chosen_class = class_map[str(reaction.emoji)]
        
        # Set class in database
        db.set_user_class(ctx.author.id, ctx.guild.id, chosen_class)
        
        # Sync class to web app
        asyncio.create_task(db.sync_class_to_web(str(ctx.author.id), chosen_class))
        
        # Wait for DB write to complete
        await asyncio.sleep(0.15)
        
        # Give role
        role_id = get_class_roles(ctx.guild.id).get(chosen_class)
        if role_id and role_id != 0:
            role = ctx.guild.get_role(role_id)
            if role:
                try:
                    await ctx.author.add_roles(role, reason=f"Chose {chosen_class} class")
                except Exception as e:
                    print(f"❌ Error adding class role: {e}")
        
        await ctx.send(
            f"✅ **CLASS SELECTED**\n"
            f"{ctx.author.mention} is now a **{str(reaction.emoji)} {chosen_class}**!\n"
            f"Your specialization is active. Good luck, hunter! 🎮"
        )
        
    except asyncio.TimeoutError:
        await ctx.send("⏰ Class selection timed out. Use `!chooseclass` to try again.")
    except Exception as e:
        print(f"❌ Error in chooseclass: {e}")
        await ctx.send("❌ Error selecting class. Please try again.")

@bot.command()
async def myclass(ctx, member: discord.Member = None):
    """View your (or another user's) class"""
    member = member or ctx.author
    
    user_class = db.get_user_class(member.id, ctx.guild.id)
    
    if not user_class:
        user_data = db.get_user(member.id, ctx.guild.id)
        if user_data:
            current_level = level_from_xp(user_data['xp'], ctx.guild.id)
            if current_level < CLASS_UNLOCK_LEVEL:
                await ctx.send(f"{member.mention} hasn't unlocked classes yet (need Level {CLASS_UNLOCK_LEVEL})")
            else:
                await ctx.send(f"{member.mention} hasn't chosen a class yet! Use `!chooseclass` to select one.")
        else:
            await ctx.send(f"{member.mention} has no data yet.")
        return
    
    class_emoji = {
        "TANK": "🛡️",
        "ASSASSIN": "🗡️",
        "FIGHTER": "⚔️",
        "RANGER": "🏹",
        "HEALER": "💚",
        "MAGE": "🔮"
    }
    
    # Class details (same as chooseclass)
    class_details = {
        "TANK": (
            "**Endurance Specialist**\n\n"
            "• **1.8x Voice XP**\n"
            "• **50% faster cooldowns** (30s → 15s)\n"
            "• Trade-off: 0.9x Message XP\n\n"
            "*Best for: Voice chat lovers*"
        ),
        "ASSASSIN": (
            "**Precision Striker**\n\n"
            "• **1.5x Message XP**\n"
            "• **15% chance for 2x XP**\n"
            "• **Combo**: +5% per message (max 20%)\n"
            "• Trade-off: 0.8x Voice XP\n\n"
            "*Best for: Active chatters*"
        ),
        "FIGHTER": (
            "**Balanced Warrior**\n\n"
            "• **1.2x All XP**\n"
            "• **Daily streak**: +5% per day (max 25%)\n"
            "• **Immune to spam penalty**\n\n"
            "*Best for: Consistent players*"
        ),
        "RANGER": (
            "**Strategic Hunter**\n\n"
            "• **Pick 1 focus channel: 2x XP**\n"
            "• **Other channels: 0.8x XP**\n"
            "• Can change focus weekly\n\n"
            "*Best for: Strategic players*"
        ),
        "HEALER": (
            "**Support Specialist**\n\n"
            "• **1.5x Daily rewards**\n"
            "• **+25 XP for @mentions** (5min cd)\n"
            "• **Voice aura**: +5% XP to everyone\n"
            "• Trade-off: 0.9x solo XP\n\n"
            "*Best for: Community supporters*"
        ),
        "MAGE": (
            "**Knowledge Seeker**\n\n"
            "• **1.4x XP for long messages** (50+ chars)\n"
            "• **Store 3 dailies**, claim all (1.5x bonus)\n"
            "• Trade-off: 0.7x for short messages\n\n"
            "*Best for: Quality contributors*"
        )
    }
    
    embed = discord.Embed(
        title=f"{class_emoji.get(user_class, '❓')} {user_class}",
        description=f"{member.mention}'s hunter class\n\n{class_details.get(user_class, 'Unknown class')}",
        color=0x00d4ff
    )
    
    # Add class-specific stats
    user_data = db.get_user(member.id, ctx.guild.id)
    
    if user_class == "FIGHTER":
        streak = user_data.get('daily_streak', 0)
        streak_bonus = min(streak * 5, 25)
        embed.add_field(name="Daily Streak", value=f"{streak} days (+{streak_bonus}% XP)", inline=True)
    
    elif user_class == "MAGE":
        stored = user_data.get('stored_dailies', 0)
        embed.add_field(name="Stored Dailies", value=f"{stored}/3", inline=True)
    
    elif user_class == "ASSASSIN":
        combo = user_data.get('message_combo', 0)
        combo_bonus = min(combo * 5, 20)
        embed.add_field(name="Message Combo", value=f"{combo} (+{combo_bonus}% XP)", inline=True)
    
    elif user_class == "RANGER":
        focus = user_data.get('focus_channel')
        if focus:
            embed.add_field(name="Focus Channel", value=f"<#{focus}>", inline=True)
            can_change = db.can_change_focus(member.id, ctx.guild.id)
            embed.add_field(name="Can Change", value="✅ Yes" if can_change else "❌ No (7 day cooldown)", inline=True)
        else:
            embed.add_field(name="Focus Channel", value="Not set - use `!setfocus #channel`", inline=True)
    
    await ctx.send(embed=embed)

@bot.command()
async def setfocus(ctx, channel: discord.TextChannel = None):
    """Set your focus channel (RANGER only)"""
    user_class = db.get_user_class(ctx.author.id, ctx.guild.id)
    
    if user_class != "RANGER":
        await ctx.send("❌ Only **🏹 RANGER** class can use this command!")
        return
    
    if not channel:
        await ctx.send("❌ Please specify a channel: `!setfocus #channel`")
        return
    
    # Check if can change (7 day cooldown)
    if not db.can_change_focus(ctx.author.id, ctx.guild.id):
        await ctx.send("❌ You can only change your focus channel once per week!")
        return
    
    # Set focus channel
    db.set_focus_channel(ctx.author.id, ctx.guild.id, channel.id)
    
    await ctx.send(
        f"🏹 **FOCUS CHANNEL SET**\n"
        f"{ctx.author.mention} is now focused on {channel.mention}!\n"
        f"• **2x XP** in this channel\n"
        f"• **0.8x XP** in all other channels\n"
        f"You can change this again in 7 days."
    )

@bot.command()
async def claimstored(ctx):
    """Claim all stored daily rewards (MAGE only)"""
    user_class = db.get_user_class(ctx.author.id, ctx.guild.id)
    
    if user_class != "MAGE":
        await ctx.send("❌ Only **🔮 MAGE** class can use this command!")
        return
    
    user_data = db.get_user(ctx.author.id, ctx.guild.id)
    stored = user_data.get('stored_dailies', 0)
    
    if stored == 0:
        await ctx.send("❌ You have no stored daily rewards! Use `!daily` to store them (max 3).")
        return
    
    # Calculate rewards (1.5x bonus for claiming all at once)
    current_level = level_from_xp(user_data['xp'], ctx.guild.id)
    base_daily = int(0.2 * ((current_level * 150) + 50))
    mage_daily = int(base_daily * 1.5)  # MAGE multiplier
    total_xp = int(mage_daily * stored * 1.5)  # 1.5x bonus for bulk claim
    
    # Award XP
    db.add_xp(ctx.author.id, ctx.guild.id, total_xp)
    
    # Sync mage daily XP to web app
    asyncio.create_task(db.sync_xp_to_web(str(ctx.author.id), total_xp, "discord_mage_daily"))
    
    # Clear stored dailies
    db.use_stored_dailies(ctx.author.id, ctx.guild.id)
    
    await ctx.send(
        f"🔮 **MANA BURST**\n"
        f"{ctx.author.mention} claimed **{stored} stored dailies** with **1.5x bonus**!\n"
        f"**+{total_xp:,} XP** awarded! ⚡"
    )

@bot.command()
async def classinfo(ctx):
    """View detailed information about all classes"""
    embed = discord.Embed(
        title="🎮 HUNTER CLASS SYSTEM",
        description=f"Unlock at **Level {CLASS_UNLOCK_LEVEL}**. Choose wisely - it's permanent!",
        color=0xff6b6b
    )
    
    embed.add_field(
        name="🛡️ TANK - Endurance Specialist",
        value=(
            "**Strengths:**\n"
            "• 1.8x Voice XP\n"
            "• 50% faster message cooldowns\n\n"
            "**Weaknesses:**\n"
            "• 0.9x Message XP\n\n"
            "**Playstyle:** Voice chat grinder"
        ),
        inline=True
    )
    
    embed.add_field(
        name="🗡️ ASSASSIN - Precision Striker",
        value=(
            "**Strengths:**\n"
            "• 1.5x Message XP\n"
            "• 15% chance for 2x XP\n"
            "• Combo system (+20% max)\n\n"
            "**Weaknesses:**\n"
            "• 0.8x Voice XP\n\n"
            "**Playstyle:** Active chatter"
        ),
        inline=True
    )
    
    embed.add_field(
        name="⚔️ FIGHTER - Balanced Warrior",
        value=(
            "**Strengths:**\n"
            "• 1.2x All XP\n"
            "• Daily streak (+25% max)\n"
            "• Spam immunity\n\n"
            "**Weaknesses:**\n"
            "• None\n\n"
            "**Playstyle:** Consistent daily"
        ),
        inline=True
    )
    
    embed.add_field(
        name="🏹 RANGER - Strategic Hunter",
        value=(
            "**Strengths:**\n"
            "• 2x XP in focus channel\n"
            "• Weekly focus change\n\n"
            "**Weaknesses:**\n"
            "• 0.8x XP in other channels\n\n"
            "**Playstyle:** Strategic focus"
        ),
        inline=True
    )
    
    embed.add_field(
        name="💚 HEALER - Support Specialist",
        value=(
            "**Strengths:**\n"
            "• 1.5x Daily rewards\n"
            "• +25 XP for @mentions\n"
            "• Voice aura (+5% to all)\n\n"
            "**Weaknesses:**\n"
            "• 0.9x solo XP\n\n"
            "**Playstyle:** Community support"
        ),
        inline=True
    )
    
    embed.add_field(
        name="🔮 MAGE - Knowledge Seeker",
        value=(
            "**Strengths:**\n"
            "• 1.4x long message XP\n"
            "• Store 3 dailies (1.5x bonus)\n\n"
            "**Weaknesses:**\n"
            "• 0.7x short message XP\n\n"
            "**Playstyle:** Quality contributor"
        ),
        inline=True
    )
    
    embed.add_field(
        name="📋 Commands",
        value=(
            "`!chooseclass` - Select your class\n"
            "`!myclass [@user]` - View class info\n"
            "`!setfocus #channel` - Set focus (RANGER)\n"
            "`!claimstored` - Claim dailies (MAGE)"
        ),
        inline=False
    )
    
    embed.set_footer(text="All classes balanced to ~120-130% total XP")
    
    await ctx.send(embed=embed)

# -------------------------
# RUN BOT
# -------------------------
if __name__ == "__main__":
    bot.run(bot_config.TOKEN)
