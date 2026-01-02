import sqlite3
import os
from datetime import datetime, timedelta
import json
import queue
import threading
import time
from contextlib import contextmanager
import aiohttp
import asyncio

class Database:
    def __init__(self, db_path="system.db"):
        self.db_path = db_path
        self.write_queue = queue.Queue()
        self.worker_thread = None
        self.stop_worker = False
        self._local = threading.local()
        
        self.init_db()
        self.add_monthly_xp_column()
        self.add_class_columns()
        
        # Start the write worker thread
        self.start_write_worker()
    
    @contextmanager
    def get_conn(self):
        """Context manager for safe connection handling"""
        conn = None
        try:
            conn = sqlite3.connect(
                self.db_path,
                timeout=30.0,  # Increased timeout
                check_same_thread=False,
                isolation_level='IMMEDIATE'  # Better for concurrent writes
            )
            conn.execute('PRAGMA journal_mode=WAL')  # Write-Ahead Logging
            conn.execute('PRAGMA busy_timeout=30000')  # 30 second busy timeout
            yield conn
        finally:
            if conn:
                try:
                    conn.close()
                except Exception as e:
                    print(f"Error closing connection: {e}")

    def start_write_worker(self):
        """Start the background thread that processes DB writes serially."""
        self.stop_worker = False
        self.worker_thread = threading.Thread(target=self._write_worker_loop, daemon=True)
        self.worker_thread.start()
        print("✅ DB write worker thread started")

    def _write_worker_loop(self):
        """Background thread loop: process writes from the queue one at a time."""
        while not self.stop_worker:
            try:
                item = self.write_queue.get(timeout=1.0)
                if item is None:
                    break
                query, params = item
                
                max_retries = 5
                for attempt in range(max_retries):
                    try:
                        with self.get_conn() as conn:
                            c = conn.cursor()
                            c.execute(query, params)
                            conn.commit()
                        break  # Success
                    except sqlite3.OperationalError as e:
                        if attempt < max_retries - 1 and ('locked' in str(e).lower() or 'busy' in str(e).lower()):
                            time.sleep(0.1 * (2 ** attempt))  # Exponential backoff
                            continue
                        print(f"❌ Write worker error (attempt {attempt + 1}): {e}")
                        break
                    except Exception as e:
                        print(f"❌ Write worker error: {e}")
                        break
                        
            except queue.Empty:
                continue
            except Exception as e:
                print(f"❌ Write worker exception: {e}")

    def queue_write(self, query, params=()):
        """Queue a write operation (INSERT, UPDATE, DELETE) to be processed serially."""
        self.write_queue.put((query, params))

    def stop_write_worker(self):
        """Gracefully stop the write worker thread."""
        self.stop_worker = True
        self.write_queue.put(None)  # Signal to stop
        if self.worker_thread:
            self.worker_thread.join(timeout=5.0)
            print("🛑 DB write worker thread stopped")

    def _execute_query(self, query, params=(), fetchone=False, fetchall=False, commit=False, retries=5):
        """Execute a query with proper connection management and retries"""
        last_exc = None
        backoff = 0.05
        
        for attempt in range(retries):
            try:
                with self.get_conn() as conn:
                    c = conn.cursor()
                    c.execute(query, params)
                    
                    if commit:
                        conn.commit()
                    
                    result = None
                    if fetchone:
                        result = c.fetchone()
                    elif fetchall:
                        result = c.fetchall()
                    
                    return result
                    
            except sqlite3.OperationalError as e:
                last_exc = e
                msg = str(e).lower()
                if 'locked' in msg or 'busy' in msg:
                    if attempt < retries - 1:
                        time.sleep(backoff)
                        backoff = min(2.0, backoff * 2)
                        continue
                raise
                
            except sqlite3.ProgrammingError as e:
                last_exc = e
                msg = str(e).lower()
                if 'closed' in msg or 'cannot operate' in msg:
                    if attempt < retries - 1:
                        print(f"⚠️ Database closed, retrying... (attempt {attempt + 1}/{retries})")
                        time.sleep(backoff)
                        backoff = min(2.0, backoff * 2)
                        continue
                raise
                
            except Exception as e:
                print(f"❌ Unexpected database error: {e}")
                raise
        
        # Exhausted retries
        if last_exc:
            raise last_exc
        raise Exception("Database operation failed after retries")
    
    def init_db(self):
        """Initialize database with all tables"""
        with self.get_conn() as conn:
            c = conn.cursor()
            
            # Users table
            c.execute('''CREATE TABLE IF NOT EXISTS users (
                user_id TEXT,
                guild_id TEXT,
                xp INTEGER DEFAULT 0,
                messages INTEGER DEFAULT 0,
                voice_time INTEGER DEFAULT 0,
                last_xp_time TEXT,
                last_daily TEXT,
                PRIMARY KEY (user_id, guild_id)
            )''')
            
            # Guild settings table
            c.execute('''CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id TEXT PRIMARY KEY,
                xp_min INTEGER DEFAULT 15,
                xp_max INTEGER DEFAULT 25,
                xp_cooldown INTEGER DEFAULT 60,
                voice_xp_enabled INTEGER DEFAULT 1,
                voice_xp_rate INTEGER DEFAULT 5,
                daily_enabled INTEGER DEFAULT 1,
                daily_reward INTEGER DEFAULT 500,
                levelup_messages INTEGER DEFAULT 1,
                levelup_channel TEXT,
                blacklisted_channels TEXT,
                whitelisted_channels TEXT,
                role_multipliers TEXT,
                prefix_commands_enabled INTEGER DEFAULT 1,
                xp_formula TEXT
            )''')
            
            # XP history table
            c.execute('''CREATE TABLE IF NOT EXISTS xp_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                guild_id TEXT,
                xp INTEGER,
                timestamp TEXT
            )''')
            
            # Seasons table
            c.execute('''CREATE TABLE IF NOT EXISTS seasons (
                guild_id TEXT,
                season_id TEXT,
                winners TEXT,
                ended_at TEXT,
                PRIMARY KEY (guild_id, season_id)
            )''')
            
            conn.commit()
    
    # =====================================
    # WEB APP SYNC METHODS (NEW)
    # =====================================
    
    async def sync_xp_to_web(self, discord_id: str, xp_amount: int, source: str = "discord"):
        """
        Sync XP earned in Discord to the web app via the bot-sync Edge Function.
        
        Args:
            discord_id: The user's Discord ID
            xp_amount: Amount of XP to add (max 1000 per call, enforced by edge function)
            source: Source of XP (e.g., "discord_message", "discord_voice", "discord_daily")
        
        Returns:
            dict with success status and data, or error message
        """
        import config as bot_config
        
        # Check if sync is configured
        if not bot_config.BOT_SYNC_SECRET or not bot_config.SUPABASE_SERVICE_ROLE_KEY:
            return {"success": False, "error": "Web sync not configured"}
        
        url = f"{bot_config.SUPABASE_URL}/functions/v1/bot-sync"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json={
                        "discord_id": str(discord_id),
                        "action": "add_xp",
                        "data": {
                            "xp": min(xp_amount, 1000),  # Cap at 1000 per call
                            "source": source
                        }
                    },
                    headers={
                        "Authorization": f"Bearer {bot_config.SUPABASE_SERVICE_ROLE_KEY}",
                        "X-Bot-Secret": bot_config.BOT_SYNC_SECRET,
                        "Content-Type": "application/json"
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    result = await response.json()
                    
                    if response.status == 200:
                        print(f"✅ Synced {xp_amount} XP to web for Discord ID {discord_id}")
                        return {"success": True, "data": result}
                    else:
                        print(f"❌ Web sync failed: {result}")
                        return {"success": False, "error": result.get("error", "Unknown error")}
                        
        except asyncio.TimeoutError:
            print(f"⚠️ Web sync timeout for {discord_id}")
            return {"success": False, "error": "Timeout"}
        except Exception as e:
            print(f"❌ Web sync error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_web_stats(self, discord_id: str):
        """
        Get user stats from the web app.
        
        Args:
            discord_id: The user's Discord ID
            
        Returns:
            dict with user stats or error
        """
        import config as bot_config
        
        if not bot_config.BOT_SYNC_SECRET or not bot_config.SUPABASE_SERVICE_ROLE_KEY:
            return {"success": False, "error": "Web sync not configured"}
        
        url = f"{bot_config.SUPABASE_URL}/functions/v1/bot-sync"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json={
                        "discord_id": str(discord_id),
                        "action": "sync_stats"
                    },
                    headers={
                        "Authorization": f"Bearer {bot_config.SUPABASE_SERVICE_ROLE_KEY}",
                        "X-Bot-Secret": bot_config.BOT_SYNC_SECRET,
                        "Content-Type": "application/json"
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    result = await response.json()
                    
                    if response.status == 200:
                        return {"success": True, "data": result}
                    else:
                        return {"success": False, "error": result.get("error", "Unknown error")}
                        
        except asyncio.TimeoutError:
            return {"success": False, "error": "Timeout"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def sync_class_to_web(self, discord_id: str, class_name: str):
        """
        Sync class selection to the web app.
        
        Args:
            discord_id: The user's Discord ID
            class_name: The selected class (e.g., "TANK", "ASSASSIN", etc.)
            
        Returns:
            dict with success status
        """
        import config as bot_config
        
        if not bot_config.BOT_SYNC_SECRET or not bot_config.SUPABASE_SERVICE_ROLE_KEY:
            return {"success": False, "error": "Web sync not configured"}
        
        url = f"{bot_config.SUPABASE_URL}/functions/v1/bot-sync"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json={
                        "discord_id": str(discord_id),
                        "action": "set_class",
                        "data": {
                            "class": class_name
                        }
                    },
                    headers={
                        "Authorization": f"Bearer {bot_config.SUPABASE_SERVICE_ROLE_KEY}",
                        "X-Bot-Secret": bot_config.BOT_SYNC_SECRET,
                        "Content-Type": "application/json"
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    result = await response.json()
                    
                    if response.status == 200:
                        print(f"✅ Synced class {class_name} to web for Discord ID {discord_id}")
                        return {"success": True, "data": result}
                    else:
                        return {"success": False, "error": result.get("error", "Unknown error")}
                        
        except Exception as e:
            print(f"❌ Class sync error: {e}")
            return {"success": False, "error": str(e)}
    
    # ----------------
    # USER OPERATIONS
    # ----------------
    def get_user(self, user_id, guild_id):
        """Get user data with proper error handling"""
        try:
            # Get column names
            columns_rows = self._execute_query("PRAGMA table_info(users)", fetchall=True)
            columns = [col[1] for col in columns_rows] if columns_rows else []
            
            # Get user data
            result = self._execute_query(
                'SELECT * FROM users WHERE user_id = ? AND guild_id = ?',
                (str(user_id), str(guild_id)),
                fetchone=True
            )
            
            if result:
                user_dict = {}
                for i, col_name in enumerate(columns):
                    if i < len(result):
                        user_dict[col_name] = result[i]
                return user_dict
            return None
            
        except Exception as e:
            print(f"❌ Error getting user {user_id}: {e}")
            return None
    
    def create_user(self, user_id, guild_id):
        """Create user with proper handling"""
        self.queue_write(
            'INSERT OR IGNORE INTO users (user_id, guild_id, xp, monthly_xp) VALUES (?, ?, ?, ?)',
            (str(user_id), str(guild_id), 0, 0)
        )
        # Small delay to ensure write completes before next read
        time.sleep(0.05)
    
    def add_xp(self, user_id, guild_id, amount):
        """Add XP with proper queueing"""
        self.queue_write('''UPDATE users 
                             SET xp = xp + ?, 
                                 monthly_xp = monthly_xp + ?,
                                 messages = messages + 1, 
                                 last_xp_time = ? 
                             WHERE user_id = ? AND guild_id = ?''',
                         (amount, amount, datetime.now().isoformat(), str(user_id), str(guild_id)))
        
        # Queue XP history
        self.queue_write(
            'INSERT INTO xp_history (user_id, guild_id, xp, timestamp) VALUES (?, ?, ?, ?)',
            (str(user_id), str(guild_id), int(amount), datetime.now().isoformat())
        )

    def get_weekly_leaderboard(self, guild_id, days=7, limit=10):
        """Get weekly leaderboard"""
        try:
            since = datetime.now() - timedelta(days=days)
            results = self._execute_query('''SELECT user_id, SUM(xp) as total_xp
                                             FROM xp_history
                                             WHERE guild_id = ? AND timestamp >= ?
                                             GROUP BY user_id
                                             ORDER BY total_xp DESC
                                             LIMIT ?''',
                                          (str(guild_id), since.isoformat(), limit),
                                          fetchall=True)
            return results if results else []
        except Exception as e:
            print(f"❌ Error getting weekly leaderboard: {e}")
            return []

    def get_user_weekly_xp(self, user_id, guild_id, days=7):
        """Get user's weekly XP"""
        try:
            since = datetime.now() - timedelta(days=days)
            res_row = self._execute_query('''SELECT SUM(xp) FROM xp_history
                                             WHERE guild_id = ? AND user_id = ? AND timestamp >= ?''',
                                          (str(guild_id), str(user_id), since.isoformat()),
                                          fetchone=True)
            res = res_row[0] if res_row else None
            return int(res) if res else 0
        except Exception as e:
            print(f"❌ Error getting weekly XP: {e}")
            return 0

    def add_voice_time(self, user_id, guild_id, seconds):
        """Add voice time"""
        self.queue_write(
            'UPDATE users SET voice_time = voice_time + ? WHERE user_id = ? AND guild_id = ?',
            (int(seconds), str(user_id), str(guild_id))
        )

    def get_voice_leaderboard(self, guild_id, limit=10):
        """Get voice leaderboard"""
        try:
            results = self._execute_query(
                '''SELECT user_id, voice_time FROM users 
                   WHERE guild_id = ? AND voice_time > 0
                   ORDER BY voice_time DESC LIMIT ?''',
                (str(guild_id), limit),
                fetchall=True
            )
            return results if results else []
        except Exception as e:
            print(f"❌ Error getting voice leaderboard: {e}")
            return []

    def get_all_user_xp(self, guild_id):
        """Get all user XP values"""
        try:
            rows = self._execute_query(
                'SELECT xp FROM users WHERE guild_id = ?',
                (str(guild_id),),
                fetchall=True
            )
            return [r[0] for r in rows] if rows else []
        except Exception as e:
            print(f"❌ Error getting all user XP: {e}")
            return []

    def get_server_aggregates(self, guild_id):
        """Get server statistics"""
        try:
            res = self._execute_query(
                'SELECT SUM(messages), SUM(xp), COUNT(*), SUM(voice_time) FROM users WHERE guild_id = ?',
                (str(guild_id),),
                fetchone=True
            )
            return {
                'total_messages': int(res[0]) if res and res[0] else 0,
                'total_xp': int(res[1]) if res and res[1] else 0,
                'total_users': int(res[2]) if res and res[2] else 0,
                'total_voice_time': int(res[3]) if res and res[3] else 0
            }
        except Exception as e:
            print(f"❌ Error getting server aggregates: {e}")
            return {'total_messages': 0, 'total_xp': 0, 'total_users': 0, 'total_voice_time': 0}

    def set_xp(self, user_id, guild_id, amount):
        """Set user XP"""
        self.queue_write(
            'UPDATE users SET xp = ? WHERE user_id = ? AND guild_id = ?',
            (amount, str(user_id), str(guild_id))
        )

    def set_last_mention_time(self, user_id, guild_id, timestamp_iso: str = None):
        """Set last mention time"""
        ts = timestamp_iso or datetime.now().isoformat()
        self.queue_write(
            'UPDATE users SET last_mention_xp = ? WHERE user_id = ? AND guild_id = ?',
            (ts, str(user_id), str(guild_id))
        )

    def set_last_daily(self, user_id, guild_id, timestamp_iso: str = None):
        """Set last daily time"""
        ts = timestamp_iso or datetime.now().isoformat()
        self.queue_write(
            'UPDATE users SET last_daily = ? WHERE user_id = ? AND guild_id = ?',
            (ts, str(user_id), str(guild_id))
        )

    def get_all_users_in_guild(self, guild_id):
        """Get all users in guild"""
        try:
            rows = self._execute_query(
                'SELECT user_id, xp FROM users WHERE guild_id = ?',
                (str(guild_id),),
                fetchall=True
            )
            return rows if rows else []
        except Exception as e:
            print(f"❌ Error getting all users: {e}")
            return []
    
    def can_gain_xp(self, user_id, guild_id, cooldown=60):
        """Check if user can gain XP"""
        try:
            user = self.get_user(user_id, guild_id)
            if not user or not user.get('last_xp_time'):
                return True
            
            last_time = datetime.fromisoformat(user['last_xp_time'])
            return (datetime.now() - last_time).total_seconds() >= cooldown
        except Exception as e:
            print(f"❌ Error checking XP cooldown: {e}")
            return True  # Allow XP on error
    
    def get_leaderboard(self, guild_id, limit=10):
        """Get leaderboard"""
        try:
            results = self._execute_query(
                '''SELECT user_id, xp, messages 
                   FROM users 
                   WHERE guild_id = ? 
                   ORDER BY xp DESC 
                   LIMIT ?''',
                (str(guild_id), limit),
                fetchall=True
            )
            return results if results else []
        except Exception as e:
            print(f"❌ Error getting leaderboard: {e}")
            return []
    
    def get_rank(self, user_id, guild_id):
        """Get user's server rank"""
        try:
            res = self._execute_query(
                '''SELECT COUNT(*) + 1 
                   FROM users 
                   WHERE guild_id = ? AND xp > (
                       SELECT xp FROM users WHERE user_id = ? AND guild_id = ?
                   )''',
                (str(guild_id), str(user_id), str(guild_id)),
                fetchone=True
            )
            return res[0] if res else 0
        except Exception as e:
            print(f"❌ Error getting rank: {e}")
            return 0
    
    def claim_daily(self, user_id, guild_id, reward_amount=None):
        """Claim daily reward"""
        try:
            user = self.get_user(user_id, guild_id)
            if not user:
                return False, "User not found"
            
            settings = self.get_guild_settings(guild_id)
            if not settings or not settings['daily_enabled']:
                return False, "Daily rewards are disabled"
            
            daily_xp = reward_amount if reward_amount is not None else settings['daily_reward']
            
            if user.get('last_daily'):
                last_daily = datetime.fromisoformat(user['last_daily'])
                if (datetime.now() - last_daily).total_seconds() < 86400:
                    time_left = 86400 - (datetime.now() - last_daily).total_seconds()
                    hours = int(time_left // 3600)
                    minutes = int((time_left % 3600) // 60)
                    return False, f"{hours}h {minutes}m"
                else:
                    user_class = self.get_user_class(user_id, guild_id)
                    if user_class == "FIGHTER":
                        time_since = (datetime.now() - last_daily).total_seconds()
                        if time_since < 172800:
                            self.increment_daily_streak(user_id, guild_id)
                        else:
                            self.reset_daily_streak(user_id, guild_id)
            
            self.queue_write(
                'UPDATE users SET xp = xp + ?, monthly_xp = monthly_xp + ?, last_daily = ? WHERE user_id = ? AND guild_id = ?',
                (daily_xp, daily_xp, datetime.now().isoformat(), str(user_id), str(guild_id))
            )
            
            return True, daily_xp
        except Exception as e:
            print(f"❌ Error claiming daily: {e}")
            return False, "Error claiming daily"
    
    # ----------------
    # GUILD SETTINGS
    # ----------------
    def get_guild_settings(self, guild_id):
        """Get guild settings with error handling"""
        try:
            result = self._execute_query(
                'SELECT * FROM guild_settings WHERE guild_id = ?',
                (str(guild_id),),
                fetchone=True
            )
            
            if result:
                return {
                    'guild_id': result[0],
                    'xp_min': result[1],
                    'xp_max': result[2],
                    'xp_cooldown': result[3],
                    'voice_xp_enabled': bool(result[4]),
                    'voice_xp_rate': result[5],
                    'daily_enabled': bool(result[6]),
                    'daily_reward': result[7],
                    'levelup_messages': bool(result[8]),
                    'levelup_channel': result[9],
                    'blacklisted_channels': json.loads(result[10]) if result[10] else [],
                    'whitelisted_channels': json.loads(result[11]) if result[11] else [],
                    'role_multipliers': json.loads(result[12]) if result[12] else {},
                    'prefix_commands_enabled': bool(result[13]) if len(result) > 13 and result[13] is not None else True,
                    'xp_formula': result[14] if len(result) > 14 else None
                }
        except Exception as e:
            print(f"❌ Error getting guild settings: {e}")
        
        # Return defaults
        return {
            'guild_id': str(guild_id),
            'xp_min': 15,
            'xp_max': 25,
            'xp_cooldown': 60,
            'voice_xp_enabled': True,
            'voice_xp_rate': 5,
            'daily_enabled': True,
            'daily_reward': 500,
            'levelup_messages': True,
            'levelup_channel': None,
            'blacklisted_channels': [],
            'whitelisted_channels': [],
            'role_multipliers': {},
            'prefix_commands_enabled': True,
            'xp_formula': None
        }
    
    def init_guild_settings(self, guild_id):
        """Initialize guild settings"""
        self.queue_write(
            'INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)',
            (str(guild_id),)
        )
    
    def update_guild_setting(self, guild_id, setting, value):
        """Update guild setting"""
        self.init_guild_settings(guild_id)
        
        if isinstance(value, (list, dict)):
            value = json.dumps(value)
        
        self.queue_write(
            f'UPDATE guild_settings SET {setting} = ? WHERE guild_id = ?',
            (value, str(guild_id))
        )
    
    def add_blacklisted_channel(self, guild_id, channel_id):
        """Add blacklisted channel"""
        settings = self.get_guild_settings(guild_id)
        blacklist = settings['blacklisted_channels']
        if str(channel_id) not in blacklist:
            blacklist.append(str(channel_id))
            self.update_guild_setting(guild_id, 'blacklisted_channels', blacklist)
    
    def remove_blacklisted_channel(self, guild_id, channel_id):
        """Remove blacklisted channel"""
        settings = self.get_guild_settings(guild_id)
        blacklist = settings['blacklisted_channels']
        if str(channel_id) in blacklist:
            blacklist.remove(str(channel_id))
            self.update_guild_setting(guild_id, 'blacklisted_channels', blacklist)
    
    def add_whitelisted_channel(self, guild_id, channel_id):
        """Add whitelisted channel"""
        settings = self.get_guild_settings(guild_id)
        whitelist = settings['whitelisted_channels']
        if str(channel_id) not in whitelist:
            whitelist.append(str(channel_id))
            self.update_guild_setting(guild_id, 'whitelisted_channels', whitelist)
    
    def remove_whitelisted_channel(self, guild_id, channel_id):
        """Remove whitelisted channel"""
        settings = self.get_guild_settings(guild_id)
        whitelist = settings['whitelisted_channels']
        if str(channel_id) in whitelist:
            whitelist.remove(str(channel_id))
            self.update_guild_setting(guild_id, 'whitelisted_channels', whitelist)
    
    def set_role_multiplier(self, guild_id, role_id, multiplier):
        """Set role multiplier"""
        settings = self.get_guild_settings(guild_id)
        multipliers = settings['role_multipliers']
        multipliers[str(role_id)] = float(multiplier)
        self.update_guild_setting(guild_id, 'role_multipliers', multipliers)
    
    def remove_role_multiplier(self, guild_id, role_id):
        """Remove role multiplier"""
        settings = self.get_guild_settings(guild_id)
        multipliers = settings['role_multipliers']
        if str(role_id) in multipliers:
            del multipliers[str(role_id)]
            self.update_guild_setting(guild_id, 'role_multipliers', multipliers)
    
    def is_channel_allowed(self, guild_id, channel_id):
        """Check if channel can give XP"""
        try:
            settings = self.get_guild_settings(guild_id)
            channel_id = str(channel_id)
            
            if channel_id in settings['blacklisted_channels']:
                return False
            
            if settings['whitelisted_channels'] and channel_id not in settings['whitelisted_channels']:
                return False
            
            return True
        except Exception as e:
            print(f"❌ Error checking channel: {e}")
            return True  # Allow on error
    
    def get_user_multiplier(self, member):
        """Get user's XP multiplier"""
        try:
            settings = self.get_guild_settings(member.guild.id)
            multipliers = settings['role_multipliers']
            
            if not multipliers:
                return 1.0
            
            max_multiplier = 1.0
            for role in member.roles:
                role_mult = multipliers.get(str(role.id), 1.0)
                max_multiplier = max(max_multiplier, role_mult)
            
            return max_multiplier
        except Exception as e:
            print(f"❌ Error getting multiplier: {e}")
            return 1.0
    
    # ----------------
    # SEASON METHODS
    # ----------------
    def get_season_leaderboard(self, guild_id, season_id, limit=10):
        """Get season leaderboard"""
        try:
            results = self._execute_query(
                '''SELECT user_id, monthly_xp 
                   FROM users 
                   WHERE guild_id = ? AND monthly_xp > 0
                   ORDER BY monthly_xp DESC 
                   LIMIT ?''',
                (str(guild_id), limit),
                fetchall=True
            )
            return results if results else []
        except Exception as e:
            print(f"❌ Error getting season leaderboard: {e}")
            return []
    
    def add_monthly_xp_column(self):
        """Add monthly_xp column if missing"""
        try:
            with self.get_conn() as conn:
                c = conn.cursor()
                c.execute("PRAGMA table_info(users)")
                columns = [column[1] for column in c.fetchall()]
                
                if 'monthly_xp' not in columns:
                    print("➕ Adding monthly_xp column...")
                    c.execute('ALTER TABLE users ADD COLUMN monthly_xp INTEGER DEFAULT 0')
                    c.execute('UPDATE users SET monthly_xp = xp')
                    conn.commit()
                    print("✅ monthly_xp column added")
        except Exception as e:
            print(f"❌ Error adding monthly_xp: {e}")

    def add_class_columns(self):
        """Add class-related columns"""
        try:
            with self.get_conn() as conn:
                c = conn.cursor()
                c.execute("PRAGMA table_info(users)")
                columns = [column[1] for column in c.fetchall()]
                
                new_columns = {
                    'class': 'TEXT DEFAULT NULL',
                    'daily_streak': 'INTEGER DEFAULT 0',
                    'stored_dailies': 'INTEGER DEFAULT 0',
                    'last_mention_xp': 'TEXT DEFAULT NULL',
                    'focus_channel': 'TEXT DEFAULT NULL',
                    'focus_channel_set': 'TEXT DEFAULT NULL',
                    'message_combo': 'INTEGER DEFAULT 0',
                    'last_message_time': 'TEXT DEFAULT NULL'
                }
                
                for col_name, col_type in new_columns.items():
                    if col_name not in columns:
                        print(f"➕ Adding {col_name} column...")
                        c.execute(f'ALTER TABLE users ADD COLUMN {col_name} {col_type}')
                        conn.commit()
                        print(f"✅ {col_name} column added")
        except Exception as e:
            print(f"❌ Error adding class columns: {e}")

    def save_season_winners(self, guild_id, season_id, winner_ids):
        """Save season winners"""
        winners_json = json.dumps(winner_ids)
        self.queue_write(
            '''INSERT OR REPLACE INTO seasons (guild_id, season_id, winners, ended_at)
               VALUES (?, ?, ?, ?)''',
            (str(guild_id), season_id, winners_json, datetime.now().isoformat())
        )

    def get_season_winners(self, guild_id, limit=12):
        """Get season winners"""
        try:
            results = self._execute_query(
                '''SELECT season_id, winners
                   FROM seasons
                   WHERE guild_id = ?
                   ORDER BY season_id DESC
                   LIMIT ?''',
                (str(guild_id), limit),
                fetchall=True
            )
            return results if results else []
        except Exception as e:
            print(f"❌ Error getting season winners: {e}")
            return []

    def reset_season(self, guild_id):
        """Reset season"""
        self.queue_write(
            'UPDATE users SET monthly_xp = 0 WHERE guild_id = ?',
            (str(guild_id),)
        )
    
    # -------------------------
    # CLASS SYSTEM FUNCTIONS
    # -------------------------
    
    def set_user_class(self, user_id, guild_id, class_name):
        """Set user class"""
        self.queue_write(
            'UPDATE users SET class = ? WHERE user_id = ? AND guild_id = ?',
            (class_name, str(user_id), str(guild_id))
        )
        time.sleep(0.05)  # Small delay to ensure write completes
    
    def get_user_class(self, user_id, guild_id):
        """Get user class"""
        user = self.get_user(user_id, guild_id)
        return user.get('class') if user else None
    
    def increment_daily_streak(self, user_id, guild_id):
        """Increment daily streak"""
        self.queue_write(
            'UPDATE users SET daily_streak = daily_streak + 1 WHERE user_id = ? AND guild_id = ?',
            (str(user_id), str(guild_id))
        )
    
    def reset_daily_streak(self, user_id, guild_id):
        """Reset daily streak"""
        self.queue_write(
            'UPDATE users SET daily_streak = 0 WHERE user_id = ? AND guild_id = ?',
            (str(user_id), str(guild_id))
        )
    
    def add_stored_daily(self, user_id, guild_id):
        """Add stored daily for MAGE (max 3)"""
        try:
            user = self.get_user(user_id, guild_id)
            stored = user.get('stored_dailies', 0) if user else 0
            if stored < 3:
                self.queue_write(
                    'UPDATE users SET stored_dailies = stored_dailies + 1 WHERE user_id = ? AND guild_id = ?',
                    (str(user_id), str(guild_id))
                )
                return True
            return False
        except Exception as e:
            print(f"❌ Error adding stored daily: {e}")
            return False
    
    def use_stored_dailies(self, user_id, guild_id):
        """Use all stored dailies for MAGE"""
        try:
            user = self.get_user(user_id, guild_id)
            stored = user.get('stored_dailies', 0) if user else 0
            if stored > 0:
                self.queue_write(
                    'UPDATE users SET stored_dailies = 0 WHERE user_id = ? AND guild_id = ?',
                    (str(user_id), str(guild_id))
                )
            return stored
        except Exception as e:
            print(f"❌ Error using stored dailies: {e}")
            return 0
    
    def set_focus_channel(self, user_id, guild_id, channel_id):
        """Set RANGER's focus channel"""
        self.queue_write(
            'UPDATE users SET focus_channel = ?, focus_channel_set = ? WHERE user_id = ? AND guild_id = ?',
            (str(channel_id), datetime.now().isoformat(), str(user_id), str(guild_id))
        )
    
    def get_focus_channel(self, user_id, guild_id):
        """Get RANGER's focus channel"""
        try:
            user = self.get_user(user_id, guild_id)
            return user.get('focus_channel') if user else None
        except Exception as e:
            print(f"❌ Error getting focus channel: {e}")
            return None
    
    def can_change_focus(self, user_id, guild_id):
        """Check if RANGER can change focus channel (7 day cooldown)"""
        try:
            user = self.get_user(user_id, guild_id)
            if not user or not user.get('focus_channel_set'):
                return True
            
            last_set = datetime.fromisoformat(user['focus_channel_set'])
            days_passed = (datetime.now() - last_set).total_seconds() / 86400
            return days_passed >= 7
        except Exception as e:
            print(f"❌ Error checking focus cooldown: {e}")
            return True  # Allow on error
    
    def increment_message_combo(self, user_id, guild_id):
        """Increment ASSASSIN's message combo"""
        self.queue_write(
            'UPDATE users SET message_combo = message_combo + 1, last_message_time = ? WHERE user_id = ? AND guild_id = ?',
            (datetime.now().isoformat(), str(user_id), str(guild_id))
        )
    
    def reset_message_combo(self, user_id, guild_id):
        """Reset ASSASSIN's message combo"""
        self.queue_write(
            'UPDATE users SET message_combo = 0 WHERE user_id = ? AND guild_id = ?',
            (str(user_id), str(guild_id))
        )
    
    def get_message_combo(self, user_id, guild_id):
        """Get ASSASSIN's current combo"""
        try:
            user = self.get_user(user_id, guild_id)
            if not user:
                return 0
            
            # Check if combo expired (5 min gap)
            if user.get('last_message_time'):
                try:
                    last_time = datetime.fromisoformat(user['last_message_time'])
                    if (datetime.now() - last_time).total_seconds() > 300:  # 5 min
                        self.reset_message_combo(user_id, guild_id)
                        return 0
                except Exception:
                    return 0
            
            return user.get('message_combo', 0)
        except Exception as e:
            print(f"❌ Error getting message combo: {e}")
            return 0
