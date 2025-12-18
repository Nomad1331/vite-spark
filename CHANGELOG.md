# CHANGELOG

All notable changes to the Solo Leveling System will be documented in this file.

## [3.9.2] - 2025-12-18

### Added
- **Guild Hall Visual Overhaul**: Comprehensive Solo Leveling themed enhancements
  
  **Guild Banner Enhancements**:
  - Animated pulsing CYAN GLOW effect around guild emblem with box-shadow
  - BIGGER power stat display (text-3xl) with counting animation from 0 to actual value
  - GRADIENT background from slate-900 via teal-950 to slate-900
  - FLOATING ANIMATION on castle emblem (3s up/down motion)
  - Decorative L-SHAPED BRACKETS in top-left and bottom-right corners with cyan glow
  
  **Party Members Cards**:
  - Guild Master cards have GOLD GLOW border (border-yellow-500 with box-shadow)
  - POWER stat with ⚡ icon displayed next to each member's level in cyan-400
  - AVATAR BORDERS matching role colors (2px gold for Guild Master, 1px slate for members)
  - HOVER EFFECT: cards scale to 1.02 and lift -2px
  - MANAGE button (MoreVertical icon) appears on hover with improved styling
  
  **System Messages Chat**:
  - ⚡ SYSTEM ICON before the input placeholder
  - Glowing MESSAGE BUBBLE icon in empty state with pulsing animation
  - BORDER GLOW on entire chat panel (border-violet-500/50 with box-shadow)
  - SUBTLE BACKGROUND (slate-800/30) on message bubbles with rounded corners
  - TIMESTAMPS in small cyan-400/60 text on the right of each message
  
  **Guild Challenges Empty State**:
  - Animated GLOWING TARGET icon with pulsing animation and blur effect
  - GRADIENT BACKGROUND from slate-900 to slate-950
  - LARGER text (text-xl) with cyan-400 color for "Create a challenge"
  - SUBTITLE: "Set goals and compete together" in text-sm slate-400
  - '+New' button styled with cyan-500 background and hover glow effect
  
  **Micro-Animations**:
  - All cards FADE IN + SLIDE UP with staggered delays using Framer Motion
  - HOVER SCALE effect (1.02) on all interactive cards
  - Castle icons in header FLOAT up and down (3s animation)
  - GLOW PULSE animation on Guild Master badge (gold glow intensity changes)
  - NUMBER COUNTING animation on power stat (counts from 0 over 1 second)
  
  **Tab Bar Enhancements**:
  - ACTIVE TAB indicator: glowing cyan border (3px) on bottom with box-shadow
  - HOVER GLOW on inactive tabs
  - ICONS before text: Globe for Browse Gates, Castle for My Guild, Trophy for Rankings
  
  **Atmospheric Background Effects**:
  - Floating PARTICLES in background (20 tiny cyan dots, very low opacity 0.05-0.1)
  - RADIAL GRADIENT overlay from center to edges for depth

### Technical
- Added `animate-glow-pulse-gold` CSS animation for gold glow effects
- Added floating particle animation system using Framer Motion
- Updated GuildBanner component with useEffect for number counting animation
- Enhanced MemberCard with role-based glow effects
- Updated GuildChallengesPanel with enhanced empty state styling

## [3.9.1] - 2025-12-15

### Fixed
- **Guild Page Auto-Scroll**: Removed auto-scroll on guild messages that caused page to jump to bottom on load. Now only scrolls when user sends a new message.
- **Competitive Duel XP Transfer**: Fixed bug where competitive mode duels weren't properly deducting XP from the loser. Now the loser loses XP equal to the prize pool (XP transfers from loser to winner).
- **Re-inviting Users to Guild**: Fixed duplicate key constraint error when re-inviting users who previously left the guild.

### Improved
- **Custom Duel Toggle UI**: Replaced confusing checkbox toggles with clear segmented button controls for Pool Growth (Growing/Fixed) and Loser Penalty (Normal/Competitive). Selected option is now visually highlighted.

## [3.9.0] - 2025-12-15

### Added
- **Real-time Toast Notifications**: Instant popup toasts when receiving new notifications
  - 🏰 Guild invite toasts with "View" action button
  - 👤 Friend request toasts with navigation to Friends page
  - ⚔️ Duel challenge toasts with quick access to pending challenges
  - Only triggers for NEW notifications (not on initial load)

- **Solo Leveling Guild UI Redesign**: Complete visual overhaul of the Guilds page
  - **Epic Header**: Dramatic "GUILD HALL" title with animated castle icons, glowing effects, and decorative elements
  - **Guild Gate Cards**: Power tier-based styling with color-coded glowing borders:
    - Legendary (10k+ power): Gold glow
    - Epic (5k+ power): Purple glow
    - Rare (2k+ power): Cyan glow
    - Uncommon (500+ power): Green glow
    - Common: Slate borders
  - **Guild Banner**: Full-width guild display with animated emblem, power stats, role badges
  - **Party Members Panel**: Enhanced member list with role icons, power display, and hover actions
  - **System Messages Chat**: Violet-themed chat panel styled like Solo Leveling system messages
  - **Rankings Tab**: Podium styling for top 3 guilds with trophy icons and tier coloring
  - **Create Guild Modal**: Decorative corner borders and gradient styling
  - **Micro-animations**: Framer-motion entrance animations, floating effects, pulsing glows

### Technical
- Updated `src/hooks/useNotifications.ts` - Added toast triggers for real-time notifications with navigation actions
- Completely rewrote `src/pages/Guilds.tsx` - Solo Leveling themed UI with new components:
  - `GuildGateCard` - Power tier styled guild cards
  - `GuildBanner` - Full guild info display
  - `MemberCard` - Enhanced member list items
  - `RankingEntry` - Podium-style ranking rows
- Added new Lucide icons: Sparkles for decorative elements

## [3.8.0] - 2025-12-14

### Added
- **Real-time Notifications**: Instant notification updates using Supabase Realtime subscriptions
  - No more polling - notifications appear instantly when received
  - Subscribes to guild_invites, friendships, and streak_duels tables
  
- **Discord-style Notification Bubbles**: Visual notification indicators on sidebar
  - Red pill badge on menu button shows total notification count
  - Individual nav items (Guilds, Friends) show their specific notification counts
  - Animated entrance/exit with framer-motion for smooth UX
  - "X new" badge on right side of nav items for emphasis

### Technical
- Updated `src/hooks/useNotifications.ts` - Added Supabase Realtime subscriptions, page-specific counts
- Updated `src/components/AppSidebar.tsx` - Discord-style notification bubbles with animations

## [3.7.0] - 2025-12-14

### Added
- **Notification Center**: Bell icon next to profile shows all pending notifications
  - Guild invites, friend requests, and duel challenges in one place
  - Accept/decline directly from the notification dropdown
  - Badge count shows total pending notifications

- **Guild Invite Management**: Leaders can now manage pending invites
  - Revoke/cancel pending invites before they're accepted
  - View all sent invites with time remaining
  - Invites now expire in 48 hours (was 7 days)

- **Member Promotion/Demotion**: Guild Master can manage member roles
  - Promote members: Member → Elite → Vice Master
  - Demote members: Vice Master → Elite → Member
  - Kick members from the guild
  - Hover over members in the list to see manage button

### Technical
- Created `src/hooks/useNotifications.ts` - Unified notification fetching
- Created `src/components/NotificationCenter.tsx` - Notification dropdown UI
- Updated `src/hooks/useGuilds.ts` - Added revoke, promote, demote, kick functions
- Updated `src/pages/Guilds.tsx` - Added manage member and manage invites modals
- Updated `src/components/UserMenu.tsx` - Added notification center next to profile
- Database: Updated invite expiry to 48 hours, added index on expires_at

## [3.6.2] - 2025-12-14

### Added
- **Guild Invite System**: Elite members and above can now invite hunters to their guild directly from the app
  - Search for hunters by name
  - Send invites with one click
  - No more manual Supabase entries required for invite-only guilds

## [3.6.1] - 2025-12-14

### Fixed
- **Guild Creation RLS Bug**: Fixed "new row violates row-level security policy" error when creating invite-only guilds
  - Guild masters can now add themselves as members during guild creation
  - Updated RLS policy to allow: guild creators, public guild joins, and invited users

## [3.6.0] - 2025-12-14

### Added
- **HunterAvatar Component**: New reusable component for consistent avatar display across the app
  - Supports custom profile pictures (base64 images) and class emoji fallbacks
  - Available in 4 sizes: sm, md, lg, xl

### Changed
- **Profile Pictures Everywhere**: Custom profile pictures now display correctly across all pages:
  - Friends list shows actual profile pictures instead of first letter
  - Leaderboard entries display hunter avatars
  - Guild member list shows profile pictures
  - Top-right user menu button shows profile picture
  - Friend requests and search results show avatars

### Technical
- Created `src/components/HunterAvatar.tsx` - Reusable avatar component
- Updated `src/pages/Friends.tsx` - Uses HunterAvatar for friends, requests, search
- Updated `src/pages/Leaderboard.tsx` - Fetches and displays avatar in rankings
- Updated `src/pages/Guilds.tsx` - Guild members now show avatars
- Updated `src/components/UserMenu.tsx` - User button shows profile picture
- Updated `src/hooks/useGuilds.ts` - GuildMember interface includes avatar

## [3.5.0] - 2025-12-14

### Added
- **Custom Duel Mode**: Third duel option with full control over settings:
  - Set custom XP prize pool (10-10000 XP)
  - Toggle between fixed pool or growing (+3 XP daily)
  - Toggle between competitive (loser loses XP) or normal mode
- **Sequential Rank-Up Animation**: When ranking up multiple tiers (e.g., E→C), shows each intermediate rank-up animation (E→D, then D→C)

### Fixed
- **Profile Picture Persistence**: Custom uploaded avatars (base64 images) now persist correctly across page reloads and navigation
- **Competitive Duel XP Deduction**: Loser now loses the FULL reward pool amount (same as winner gains), not half
- **Immediate XP Deduction**: Competitive duel XP loss now applies immediately on forfeit, including first day

### Changed
- Rank-up animation duration reduced to 3s for smoother sequential display
- Duel mode display in pending challenges now shows custom mode details

## [3.4.0] - 2025-12-14

### Added
- **Streak Counter on Dashboard**: Current streak now displayed prominently on the main Awakening page with best streak shown
- **Streak Duel Mode Selection**: When challenging a friend, choose between:
  - **System Reward Mode**: Winner gets XP, no penalty for loser (friendly competition)
  - **Competitive Mode**: Winner takes XP from loser (higher stakes!)
- **Automatic Streak Loss Detection**: Duels now auto-complete when a player breaks their streak - no more cheating!
- **Improved Duel Challenge UI**: Modal with clear mode explanations when sending challenges
- **Duel Notification Details**: Pending duel requests now show the selected mode with clear descriptions

### Fixed
- **Stats Reset Bug**: Fixed issue where player stats (STR, AGI, INT, VIT, SEN) were resetting to 10 when switching pages
  - Cloud sync now compares progress and keeps higher values
  - Local stats are preserved if they have more progress than cloud
- **Profile Picture Display**: Custom avatars now sync properly between local storage and cloud
  - PFPs now display correctly on home page and hunter modal

### Technical
- Updated useCloudSync to intelligently merge local and cloud data
- Added duel_mode support using existing database columns
- Added checkAutoStreakLoss function for automatic duel resolution

## [3.3.0] - 2025-12-14

### Added
- **Improved Streak Duel System**: New "first to break streak loses" mechanic
  - Duels no longer have a time limit - they continue until someone breaks their streak
  - Winner takes all XP from the growing reward pool
  - Reward pool starts at 10 XP and grows by 3 XP each day
  - Players can forfeit by clicking "I Broke My Streak" button
  - XP is automatically awarded to winner

### Fixed
- **Sidebar Scrollability**: Sidebar now scrolls to show all navigation items
- **Hunter Profile Modal Avatars**: Fixed class emoji display
  - Now correctly shows class emoji (⚔️ Fighter, 🗡️ Assassin, 🏹 Hunter, etc.)
  - Supports custom profile pictures (base64 images)
  - Fixed dialog accessibility warnings
- **Profile Modal Class Display**: Avatar field now correctly maps to class emojis instead of showing raw text

### Technical
- Added `reward_pool` and `last_pool_update` columns to streak_duels table
- Added `reportStreakBreak` function to useFriends hook
- Updated HunterProfileModal to use Avatar component with proper class emoji mapping
- Added VisuallyHidden DialogDescription for accessibility

## [3.2.0] - 2025-12-14

### Added
- **Hunter Profile Modal**: Click any guild member or friend to view their detailed profile
  - Shows level, rank, power, and all 5 combat stats with progress bars
  - Total XP and weekly XP display
  - Rank-based color theming matching Solo Leveling aesthetic
  
- **Friends in Sidebar**: Friends page now accessible from main navigation

### Changed
- **Simplified Guild Access Types**: Removed "Private" option, keeping only:
  - **Public**: Anyone can see and join
  - **Invite Only**: Anyone can see, but only invited members can join
  
### Fixed
- **Guild Creation for Non-Public Guilds**: Fixed RLS policy error when creating invite-only guilds
  - Guild creators can now see their own guild immediately after creation
  - Invite-only guilds are visible to all but require invitation to join

### Technical
- Updated `src/pages/Guilds.tsx` - Added profile viewing for guild members
- Updated `src/pages/Friends.tsx` - Now uses HunterProfileModal for friend profiles
- Updated `src/components/AppSidebar.tsx` - Added Friends navigation link
- Database: Updated guild RLS policies for proper access type handling

## [3.1.0] - 2025-12-13

### Added - Phase 3 Extended: Social Features
- **Guild Weekly Challenges**: Guild-wide collaborative goals
  - Leaders can create challenges with XP/Gold rewards
  - All members can contribute progress
  - Top contributor leaderboard per challenge
  - Auto-completion when target reached
  
- **Friend System**: Connect with other hunters
  - Search for hunters by name
  - Send/accept/decline friend requests
  - View friend profiles with stats
  - Remove friends
  
- **Streak Duels**: Challenge friends to 7-day streak battles
  - Send duel challenges to friends
  - Track streak progress during active duels
  - Winner determined by highest streak at end

### Fixed
- **Guild RLS Infinite Recursion**: Fixed "infinite recursion detected in policy" error
  - Created security definer functions for membership checks
  - Guilds now work correctly without policy loops

### Technical
- Created `src/pages/Friends.tsx` - Friend management page
- Created `src/hooks/useFriends.ts` - Friend system logic
- Created `src/hooks/useGuildChallenges.ts` - Guild challenges hook
- Created `src/components/GuildChallengesPanel.tsx` - Challenges UI
- Database: Added friendships, streak_duels, guild_challenges, guild_challenge_contributions tables
- Database: Added security definer functions (is_guild_member, is_guild_leader, etc.)

## [3.0.0] - 2025-12-13

### Added - Phase 3: Guilds & Social Features
- **Guild System**: Create or join guilds (max 50 members)
  - Guild roles: Guild Master → Vice Master → Elite → Member
  - Public, Private, or Invite-Only access types
  - Guild leaderboard ranked by combined power
  - Real-time guild chat using Supabase Realtime
  - Invite system for recruiting hunters
  
- **Change Password**: Added option in user menu for logged-in users
  - Secure password update with confirmation
  - Validation for password length
  
- **Rank-Up Animation**: Epic animated effects when hunter rank changes
  - Full-screen celebration with particles
  - Rank-specific colors and icons (E→D, D→C, etc.)
  - Smooth framer-motion animations

### Technical
- Created `src/pages/Guilds.tsx` - Full guild management page
- Created `src/hooks/useGuilds.ts` - Guild state and operations
- Created `src/components/RankUpAnimation.tsx` - Animated rank-up celebration
- Created `src/components/ChangePasswordModal.tsx` - Password change dialog
- Database: Added guilds, guild_members, guild_messages, guild_invites tables
- Added framer-motion dependency for animations

## [2.2.2] - 2025-12-13

### Added
- **Forgot Password Flow**: Added password reset functionality to Auth page
  - "Forgot password?" link on sign-in form
  - Email-based password reset with redirect back to auth page
  
- **Password Visibility Toggle**: Eye button to show/hide password on both sign-in and sign-up forms

- **Loading Spinner on Awakening**: Shows loading state while auth is being determined
  - Prevents flash of first-time setup modal for logged-in users

### Fixed
- **Stats Not Updating on Login**: Fixed issue where stats showed defaults until page reload
  - Cloud sync now triggers storage event to refresh components immediately

### Changed
- **Leaderboard Visual Redesign**: Completely revamped hunter entry cards
  - Rank-based gradient backgrounds (E-Rank slate, D-Rank emerald, etc.)
  - Glowing effects matching hunter rank
  - Rank icons displayed in badges (Shield, Swords, Zap, Crown)
  - Power stat shown on each entry
  - "View Profile →" hint on hover
  - Enhanced top 3 styling with dramatic glow effects

## [2.2.1] - 2025-12-13

### Fixed
- **First-Time Setup Sign-In Option**: Added "Sign In to Continue" button on the Awakening setup screen
  - Existing users can now sign in directly instead of being forced to create a new name
  - Navigates to auth page when clicked
  
- **Cloud Profile Sync on Login**: Fixed issue where signing in didn't restore cloud profile data
  - Cloud stats and profile now properly sync to local storage on login
  - Name, avatar, title, and all stats restored from cloud
  - Welcome back toast notification when profile is restored
  - Local stats only migrate to cloud if cloud data doesn't exist yet

### Technical
- Updated `src/components/FirstTimeSetup.tsx` - Added sign-in option
- Updated `src/hooks/useCloudSync.ts` - Added `syncCloudToLocal()` function
- Updated `src/pages/Awakening.tsx` - Skip first-time setup for logged-in users

## [2.2.0] - 2025-12-13

### Added - Phase 2 Enhancements
- **Weekly Leaderboard with Database Tracking**: True weekly XP tracking in database
  - New `weekly_xp` column in player_stats table
  - Database function `add_player_xp()` that updates both total and weekly XP
  - Auto-reset function `reset_weekly_xp()` for Monday resets
  - Weekly tab now shows actual weekly XP gains with reset countdown
  
- **Clickable Hunter Profiles**: View other hunters' public stats
  - Click any hunter on the leaderboard to view their profile modal
  - Shows level, power, rank, all 5 stats with progress bars
  - Displays total XP and weekly XP
  - Solo Leveling themed modal with rank-based color styling
  
- **Auto-Sync on Login**: No more manual "Sync Local Progress" button needed
  - Automatically migrates localStorage progress to cloud on login
  - Seamless first-time user experience
  
- **Solo Leveling Style Leaderboard Redesign**: Epic visual overhaul
  - Dramatic header with animated shields and flames
  - Rank-based glow effects and color theming
  - Enhanced top 3 styling with gold/silver/bronze effects
  - Click-to-view profile hint on hover
  - Weekly reset countdown badge

### Technical
- Created `src/components/HunterProfileModal.tsx` - Hunter profile viewer
- Updated `src/pages/Leaderboard.tsx` - Complete visual redesign + profile modal
- Updated `src/hooks/useCloudSync.ts` - Auto-sync on login
- Database: Added `weekly_xp`, `week_start_date` columns to player_stats
- Database: Created `add_player_xp()` and `reset_weekly_xp()` functions

## [2.1.1] - 2025-12-13

### Fixed
- **Leaderboard Data Fetching**: Fixed "Could not find a relationship between player_stats and profiles" error
  - Changed from Supabase foreign key join to manual two-query approach
  - Fetches public profiles first, then player_stats for those users
  - Properly joins data client-side with user_id map

## [2.1.0] - 2025-12-13

### Added - Phase 2: Leaderboards
- **Hunter Rankings Page**: Compete with hunters worldwide
  - 🌍 **Global Rankings**: All-time leaderboard showing top 100 hunters
  - 📅 **Weekly Rankings**: Resets every Monday for fresh competition
  - 🏅 **Rank-based Rankings**: Compete within your rank tier (E vs E, S vs S, etc.)
  - **Multiple Sort Options**: Rank by Level, Total XP, or Power
  - **Your Position Highlighted**: See where you stand among other hunters
  - Click to view other hunters' public profiles (future feature)
  
- **Leaderboard Features**:
  - Gold/Silver/Bronze medals for top 3 positions
  - Current user highlighted with special styling
  - Responsive design for mobile and desktop
  - Call-to-action for non-logged users to join

### Technical
- Created `src/pages/Leaderboard.tsx` - Full leaderboard implementation
- Added `/leaderboard` route to `src/App.tsx`
- Added Leaderboard nav item to `src/components/AppSidebar.tsx`
- Uses existing `player_stats` and `profiles` tables with RLS

## [2.0.0] - 2025-12-13

### Added - Phase 1: Multiplayer Foundation
- **Authentication System**: Full login/signup functionality
  - Email/password authentication with validation
  - Discord OAuth integration for gaming-themed login
  - Beautiful auth page matching Solo Leveling aesthetic
  - Form validation using Zod schemas
  
- **Cloud Player Profiles**: Supabase database integration
  - `profiles` table linked to auth.users
  - `player_stats` table (cloud version of localStorage)
  - `user_roles` table for secure role management
  - Auto-creation of profile/stats on signup via database trigger
  
- **User Menu Component**: Account management in header
  - Sign in/out functionality
  - Privacy toggle (public/private profile)
  - Sync local progress to cloud button
  - Avatar with initials display
  
- **Cloud Sync System**: localStorage ↔ cloud synchronization
  - Migrate existing localStorage progress on first login
  - Real-time sync of player stats to Supabase
  - Profile privacy settings (public by default, opt-out in settings)

- **Row Level Security**: Secure data access policies
  - Public profiles viewable by everyone
  - Private profiles only visible to owner
  - Player stats visibility tied to profile privacy
  - User roles for future admin features

### Technical
- Created `src/contexts/AuthContext.tsx` - Authentication state management
- Created `src/pages/Auth.tsx` - Login/signup page with tabs
- Created `src/hooks/useCloudSync.ts` - Cloud synchronization logic
- Created `src/components/UserMenu.tsx` - Account dropdown menu
- Updated `src/App.tsx` - Added AuthProvider and /auth route
- Updated `src/components/AppSidebar.tsx` - Added UserMenu to header
- Database tables: profiles, player_stats, user_roles with RLS

### Setup Notes
- **Discord OAuth Setup Required**: 
  1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
  2. Create new application → OAuth2 → Copy Client ID & Secret
  3. Add redirect URL: `https://gdkpmyznxfthobxpyryx.supabase.co/auth/v1/callback`
  4. In Supabase Dashboard → Authentication → Providers → Discord → Paste credentials
  5. Set Site URL in Authentication → URL Configuration

## [1.28.9] - 2025-12-12

### Fixed
- **Achievement Badge Click**: Fixed click propagation so badges open detail modal instead of flipping card.
- **Flip Hint Glow**: Added subtle glow effect to "Flip for achievements/profile" text for better visibility.

## [1.28.8] - 2025-12-12

### Changed
- **Awakening Profile Card Sizing**: Increased profile card height (200px/220px) and avatar size (h-20 w-20) for better breathing room.

## [1.28.7] - 2025-12-12

### Changed
- **Awakening Profile Card Dynamic Height**: Card now animates between small height (profile side) and larger height (achievements side) when flipped, keeping UI elements visible.

## [1.28.6] - 2025-12-12

### Fixed
- **Awakening Profile Card Fixed Height**: Changed card from min-height to fixed height (160px/180px) to prevent content from pushing the Customize button off-screen.

## [1.28.5] - 2025-12-12

### Fixed
- **Awakening Profile Card Height**: Further compacted flippable card (smaller avatar, reduced padding/min-height) so the Customize button is visible above the Status and Statistics windows on desktop.

## [1.28.4] - 2025-12-12

## [1.28.3] - 2025-12-12

### Changed
- **Compact Flippable Card**: Reduced card height from 320px to 280px for cleaner look

### Fixed
- **Achievement Badge Click**: Clicking badges no longer flips the card - opens detail modal correctly
- **Achievement Detail Modal on /achievements**: All achievement cards now clickable to open detail modal

## [1.28.2] - 2025-12-12

### Changed
- **Flippable Profile/Achievements Card**: Combined PlayerProfileCard and AchievementsShowcaseCard into one flippable card
  - Front side: Player profile with avatar, name, level, power, stats
  - Back side: Top achievements showcase with rarity breakdown
  - Tap anywhere to flip between sides

### Added
- **Achievement Detail Modal**: Click any achievement badge to open detailed modal
  - Shows achievement icon, name, description, category, rarity, and points
  - **Progress indicator** for locked achievements showing how close you are to unlocking
  - Works on both unlocked and locked achievements

## [1.28.1] - 2025-12-12

### Added
- **Achievements Showcase on Awakening Page**: Flippable AchievementsShowcaseCard now displayed alongside PlayerProfileCard
  - Responsive side-by-side layout on medium+ screens
  - Shows top 5 achievements by rarity on front, full trophy case on back
  - Tap to flip interaction with view all button

## [1.28.0] - 2025-12-12

### Added
- **Achievement System**: 38 permanent badges across 7 categories (Streak, Power, Gates, Quests, Habits, Level, Special)
  - 6 rarity tiers: Common, Uncommon, Rare, Epic, Legendary, Mythic
  - Achievement Points system for tracking progress
  - Unlock popup notifications with particle effects for rare achievements
  - New `/achievements` page with filtering by category and rarity
  - Achievements displayed on Player Profile Card
  - Flippable Achievements Showcase Card component

## [1.27.0] - 2025-12-12

### Added
- **Analytics Export**: Export progress reports as image (PNG) or text file with detailed stats
  - Image export captures full analytics dashboard with charts
  - Text export creates formatted ASCII report with all metrics

### Fixed
- **Habit Auto-Completion Bug**: Fixed issue where completing one habit would cause unrelated habits to be marked as "Defeated"
  - Habits now only finalize when ALL goal days have been completed (early win) or the full period has elapsed
  - Fixed calculation logic to properly check end date instead of just days elapsed

## [1.26.0] - 2025-12-12

### Added
- **Analytics Page**: New progress analytics with weekly/monthly reports, XP trends, quest completion stats, habit completion rates, and comparison with previous periods

## [1.25.2] - 2025-12-12

### Fixed
- **FAQ Necromancer Info**: Corrected all FAQ entries about the Necromancer challenge - it's a 90-day legendary streak challenge that UNLOCKS the Necromancer Class, not a weekly challenge requiring Level 15

## [1.25.1] - 2025-12-12

### Fixed
- **Contact Page Header Overlap**: Added top padding to prevent content from being hidden under the navigation bar on mobile
- **Social Media Preview Image**: Updated og-image.png with new Awakening page screenshot for better social sharing

## [1.25.0] - 2025-12-11

### Added
- **Challenges FAQ Section**: New FAQ category explaining challenge types (Daily, Weekly, Necromancer Mode) and their rewards

### Fixed
- **FAQ Currency Formatting**: Titles now display with proper bold styling instead of raw markdown asterisks
- **Necromancer Terminology**: Fixed "Necromancer Mode" to "Necromancer Class" in profile customization FAQ (Necromancer Mode refers to the legendary challenge, Necromancer Class is the feature you enable)

## [1.24.0] - 2025-12-11

### Added
- **XP Boost Expiry Notification**: Toast notification when your XP boost expires
- **Gem Spending System**: Gems are now properly deducted when purchasing boosts that cost gems

### Fixed
- **XP Boost Shop**: Gem costs now correctly deduct from your gem balance

### Changed
- **FAQ Page Updated**: Expanded currency FAQ with detailed earning methods for Gold, Gems, and Credits
  - Explained how to earn each currency type
  - Updated XP Boost information with full details on how multipliers work

## [1.23.0] - 2025-12-11

### Added
- **Contact Page**: New page with all contact methods (Gmail, Instagram, Telegram, Discord)
  - Solo Leveling themed design with glowing cards
  - Quick connect buttons for each platform
  - Categories for bug reports, feature suggestions, and general feedback

### Fixed
- **XP Boosts Now Functional**: XP multiplier boosts from the shop actually apply to XP gains now
  - Boost multiplier applies to all positive XP (quests, habits, gates, streaks)
  - XP history now shows when boost was applied (e.g., "2x boosted!")

## [1.22.0] - 2025-12-11

### Added
- **FAQ Page**: Comprehensive help page with 8 categories covering all app features
  - Getting Started, Daily Quests, Habits, Gates, Rewards, Customization, Supporters, Data & Updates
  - Accordion-style expandable Q&A format for easy navigation

### Changed
- **Sidebar Menu Button Redesign**: Replaced generic hamburger icon with Solo Leveling styled button
  - Asymmetric glowing bars with neon cyan shadow effects
  - Animated hover state with expanding bars
  - Border glow matching the app's aesthetic
- **Removed Page Name Indicator**: Cleaned up header by removing the page name from top right

## [1.21.0] - 2025-12-11

### Added
- **Sidebar Navigation**: Replaced cluttered top navigation with a clean sidebar menu
  - All pages accessible from sidebar (Awakening, Quests, Habits, Gates, Rewards, Customize, Hall of Fame)
  - "What's New" button to manually view changelog anytime
  - Current page indicator in header

### Changed
- Simplified Customize page header (removed redundant back button)

## [1.20.21] - 2025-12-11

### Fixed
- **Stats Card Download (v15)**: Fixed stat progress bars appearing empty
  - Preserved gradient backgrounds on stat bar fills during html2canvas capture
  - Only removes decorative gradients, not functional stat bar gradients

## [1.20.20] - 2025-12-11

### Fixed
- **Stats Card Download (v14)**: Fine-grained per-element text offsets
  - Stat names (STR, AGI, INT, VIT, SEN): 1px down (-7px)
  - Stat values & emojis: 1px up (-9px)
  - Footer quote: 1px up (-9px)
  - Name, LVL, Power: unchanged (-8px)
  - Rank badge: excluded (uses padding fix)

## [1.20.16] - 2025-12-11

### Fixed
- **Stats Card Download (v10)**: Refined text offset correction
  - Text elements shifted up by 16px (reduced from 24px which was too high, 12px was too low)
  - Rank badge padding unchanged at 16px (already correct)

## [1.20.15] - 2025-12-11

### Fixed
- **Stats Card Download (v9)**: Aggressive text offset correction
  - Text elements shifted up by 24px (increased from 12px)
  - Rank badge uses padding adjustment to push text up within border

## [1.20.14] - 2025-12-11

### Fixed
- **Stats Card Download (v7)**: Fixed text content shifting down in exported images
  - Removed extra style overrides that were causing vertical shift
  - Added explicit width/height and windowWidth/windowHeight for consistent rendering
  - Only remove problematic elements (canvas, gradients) without modifying positioning

## [1.20.13] - 2025-12-11

### Fixed
- **Stats Card Download (v6)**: Fixed text content shifting down in downloaded images
  - Preserve explicit line-height, padding, and margin styles when cloning DOM
  - Fix vertical alignment in flex containers for consistent rendering
  - Maintain computed styles to prevent html2canvas rendering differences
  - Works correctly for both framed and frameless cards

## [1.20.12] - 2025-12-11

### Fixed
- **Stats Card Download (v5)**: Fixed createPattern error for both framed and frameless cards
  - Remove ALL gradient backgroundImage styles from cloned elements before capture
  - Use computedStyle to detect gradients that inline style selectors miss
  - The repeating-linear-gradient pattern was causing html2canvas to fail

## [1.20.11] - 2025-12-11

### Fixed
- **Stats Card Download with Frames (v4)**: Completely reworked capture approach
  - Use html2canvas `onclone` callback to modify cloned DOM before rendering
  - Remove canvas elements, animation overlays, and problematic CSS from clone
  - Set mixBlendMode to 'normal' on frame images to avoid html2canvas issues
  - Remove repeating-linear-gradient patterns that cause createPattern errors
  - Set solid black background instead of transparent
  - Increased delay to 500ms

## [1.20.10] - 2025-12-11

### Fixed
- **Stats Card Download with Frames (v3)**: Fixed "createPattern" error caused by particle animation canvases
  - Ignore dynamically created canvas elements during html2canvas capture
  - Hide particle animation canvases before capture and restore after
  - Added ignoreElements option to html2canvas to skip canvas elements

## [1.20.9] - 2025-12-11

### Fixed
- **Stats Card Download with Frames (v2)**: Further fix for "createPattern" error when downloading stats card with frames
  - Convert frame images to base64 data URLs before html2canvas capture to avoid CORS and rendering issues
  - Increased delay to 300ms to ensure images are fully rendered after conversion
  - Properly handle images with 0 width/height by checking naturalWidth/naturalHeight

## [1.20.8] - 2025-12-11

### Fixed
- **Stats Card Download with Frames**: Fixed "createPattern" error when downloading stats card with frames equipped
  - Added image preloading function to ensure frame images are fully loaded before html2canvas capture
  - Added small delay after image load to ensure rendering is complete
  - Cards with any frame (including supporter-exclusive frames) can now be downloaded properly

## [1.20.7] - 2025-12-11

### Fixed
- **Stats Card Download Issue**: Completely redesigned StatsCardFrame for proper image export
  - Removed oversized character image area that was causing clipping
  - Made card compact with name/level/rank header + stats directly below
  - Removed fixed aspect ratio to allow content-based height
  - Reduced max-width from 420px to 320px for better proportions
  - Stats section now properly contained within card boundaries
  - Footer quote repositioned correctly

### Changed
- **Simplified Stats Card Layout**: Cleaner, more compact design
  - Header: Name, Level, Power, Rank badge all in one row
  - Stats: All 5 stat bars in compact rounded container
  - Footer: Quote text at bottom

## [1.20.6] - 2025-12-11

### Added
- **What's New Popup**: Shows changelog after app version updates
  - Beautiful modal displaying recent changes with icons for Added/Fixed/Changed
  - Automatically appears after version update (once per version)
  - Scrollable changelog with version history

### Fixed
- **Stats Card Name Clipping**: Fixed name getting clipped when saving/sharing stats card image
  - Increased top padding to prevent clipping from frame overlap
  - Name text now fully visible in saved images
- **Rank Badge Centering**: Rank badge now properly vertically centered in its container
  - Changed from `items-start` to `items-center` alignment
  - Added explicit `flex items-center justify-center` to badge

### Technical
- Created `src/components/WhatsNewModal.tsx` for changelog display
- Updated `src/hooks/useVersionCheck.ts` with `showWhatsNew` logic and `markVersionAsSeen()`
- Updated `src/components/StatsCardFrame.tsx` - improved top bar padding and alignment
- Updated `src/App.tsx` - integrated WhatsNewModal component

## [1.20.5] - 2025-12-11

### Added
- **Tier-based cascading frame unlock system**: Supporters now automatically unlock ALL frames at or below their tier level
  - S-Rank: Unlocks all 4 supporter frames (Monarch, Sovereign, National Hunter, Guild Master)
  - A-Rank: Unlocks Sovereign, National Hunter, Guild Master
  - B-Rank: Unlocks Guild Master only
- Added `unlockedFrames` array to SupporterBenefits for tracking multiple unlocked frames
- Added `getUnlockedFramesForTier()` utility function
- Migration support for existing supporters to populate unlockedFrames

### Fixed
- **Fine-tuned supporter frame insets**:
  - National Level Hunter: Reduced bottom inset from -12 to -8, top from -12 to -10 (fixes transparent gap)
  - Shadow Monarch's Throne: Reduced top/bottom from -14 to -10 (less overflow)

## [1.20.3] - 2025-12-11

### Changed
- **Increased supporter frame sizes**: Enlarged all 4 supporter-exclusive frames to not obscure card content
  - Guild Master's Crest: frameInset from -14/-16 to -18/-20
  - National Level Hunter: frameInset from -6/-8 to -12/-14
  - Sovereign's Authority: frameInset from -8/-10 to -14/-16
  - Shadow Monarch's Throne: frameInset from -8/-10 to -14/-16
- **Reduced stats card name/rank size**: Made the top bar less cramped
  - Username: text-xl → text-base with truncate for long names
  - Level/Power text: text-sm → text-xs
  - Rank badge: text-lg with px-3 py-1.5 → text-sm with px-2 py-1
  - Added flex-1 min-w-0 and shrink-0 for proper flex layout

### Technical
- Updated `src/lib/cardFrames.ts` - increased frameInset values for supporter frames
- Updated `src/components/StatsCardFrame.tsx` - reduced typography sizes in top info bar

## [1.20.2] - 2025-12-11

### Changed
- **Replaced Sovereign's Authority and Shadow Monarch's Throne frames**: Used user-edited versions with transparent centers
  - Both frames now have custom transparent centers that don't overlay card content
- **Increased Guild Master's Crest frame size**: Enlarged frame inset from -6/-8 to -14/-16 to better fit the stats card
- **Removed blur from locked supporter frames**: Locked frames are now clearly visible with only a dark overlay
  - Kept lock icon and "[X]-Rank+ Required" text for clarity

### Technical
- Updated `src/components/CardFrameShop.tsx` - removed `backdrop-blur-[2px]` from locked exclusive frames
- Updated `src/lib/cardFrames.ts` - Guild Master's Crest frameInset increased

## [1.20.1] - 2025-12-11

### Changed
- **Regenerated Supporter Frames**: Regenerated Shadow Monarch's Throne and Sovereign's Authority frames
  - Shadow Monarch's Throne: New rectangular purple/violet frame with elegant decorative elements
  - Sovereign's Authority: New rectangular dark gold/bronze frame with crimson gems and sharp corners (removed Age of Empires/curvy aesthetic)
- **Replaced Guild Master's Crest and National Level Hunter frames**: Used user-edited versions with transparent centers
  - Guild Master's Crest: Golden ornate frame with shield emblems and transparent center
  - National Level Hunter: Blue frame with purple ribbons, star motif, and transparent center
- **Supporter Frames Order**: Reordered SUPPORTER_EXCLUSIVE_FRAMES from B-Rank to S-Rank
  - B-Rank: Guild Master's Crest, National Level Hunter
  - A-Rank: Sovereign's Authority
  - S-Rank: Shadow Monarch's Throne

### Technical
- Updated frame styles in `src/lib/cardFrames.ts` - cornerStyle changed to "sharp" for Sovereign's Authority

## [1.20.0] - 2025-12-10

### Added
- **Supabase Integration**: Connected personal Supabase project for cloud features
  - Database tables: `supporters`, `redemption_codes`, `custom_frames`
  - RLS policies for secure public access
  
- **Hall of Hunters Page** (`/supporters`): New page showcasing supporters
  - Hunter Cards Gallery design with tier-based styling
  - Supporters grouped by tier (S-Rank to E-Rank)
  - Each card shows hunter name, custom title, tier badge
  - Responsive grid layout
  - Crown navigation icon added to navbar
  
- **Supporter Tier System**: Six tiers with unique benefits
  - E-Rank ($2): Badge of appreciation
  - D-Rank ($3): Supporter badge
  - C-Rank ($5): Badge + Hall of Fame listing
  - B-Rank ($7): Badge + Exclusive "Supporter" frame
  - A-Rank ($10): All above + Custom title
  - S-Rank ($20-25): All above + Custom frame designed for them
  
- **Code Redemption System**: Unlock supporter benefits via codes
  - Modal component for entering redemption codes
  - Validates codes against Supabase database
  - Stores unlocked benefits in localStorage
  - Supports: badges, exclusive frames, custom titles
  
- **Supporter Badge Display**: Badges show on PlayerProfileCard
  - Tier-colored badge next to player name
  - Custom supporter titles override default title
  
- **Hall of Hunters Link**: Added to Awakening page statistics section

### Technical
- Created `src/lib/supporters.ts` for supporter types and utilities
- Created `src/hooks/useSupporters.ts` for fetching supporters from Supabase
- Created `src/hooks/useCodeRedemption.ts` for code validation logic
- Created `src/components/SupporterCard.tsx` for individual supporter display
- Created `src/components/CodeRedemptionModal.tsx` for code entry UI
- Created `src/pages/Supporters.tsx` for Hall of Hunters page
- Added `@supabase/supabase-js` dependency

## [1.19.1] - 2025-12-09

### Fixed
- **Tutorial Loop Bug**: Fixed issue where completing the tutorial would loop back to the first-time setup screen
  - The problem was that `handleTutorialComplete` used stale React state instead of reading fresh data from localStorage
  - Now reads current stats from storage before updating `hasSeenTutorial` flag
  - Removed unnecessary page reload after tutorial completion

### Added
- **Ko-Fi Donation Button**: Added "Support the Hunter" button to Rewards page header
  - Links to creator's Ko-Fi page (https://ko-fi.com/nomad1331)
  - Styled to match Solo Leveling theme with heart icon

## [1.19.0] - 2025-12-09

### Added
- **Onboarding Tutorial System**: Comprehensive 7-step tutorial for new players
  - Automatically shows after first-time setup completes
  - Covers: Welcome, Daily Quests, Habits, Gates, Leveling Up, Rewards, Quick Start Tips
  - Beautiful animated UI matching Solo Leveling aesthetic
  - Progress dots to navigate between steps
  - Skip button for returning players
  - "View Tutorial" button added to Customize page for replaying anytime
- **TutorialModal Component**: New reusable component at `src/components/TutorialModal.tsx`

### Technical
- Added `hasSeenTutorial` property to player stats for tracking tutorial completion
- Tutorial shows automatically once, then accessible from Customize page

## [1.18.3] - 2025-12-09

### Added
- **XP Boosts Level Gate**: XP Boost Shop now requires Level 10 to access
  - Shows lock icon on tab when below level 10
  - Displays locked state with progress bar showing current level vs required level
  - Prevents new players from accessing powerful boosts too early

## [1.18.2] - 2025-12-09

### Fixed
- **XP Boost Shop Crash**: Fixed "Cannot read properties of null (reading 'expiresAt')" error that caused blank screen
  - Added null check for parsed boost object before accessing expiresAt property
  - Added try-catch wrapper for JSON.parse to handle malformed localStorage data
  - Cleans up invalid localStorage entries automatically

## [1.18.1] - 2025-12-09

### Fixed
- **Vercel Direct URL/Refresh 404 Error**: Added `vercel.json` with rewrites configuration to properly handle client-side routing. Previously, directly accessing any route other than `/` (e.g., `/customize`, `/gates`) or refreshing a page would show a 404 error because Vercel's server couldn't find the path. Now all routes are redirected to the SPA's index.html, allowing React Router to handle them.
- **Import Data Black Screen Bug (Complete Fix)**: Extended the `hasMounted` pattern to Gates.tsx, ChallengesPanel.tsx, and Customize.tsx. These components were overwriting freshly imported localStorage data with stale React state on initial render. Now all components wait until after mount before persisting state changes.

## [1.18.0] - 2025-12-09

### Fixed
- **Import Data Black Screen Bug**: Fixed an issue where importing backup data would cause a black/blank screen. The problem was that the `usePlayerStats` hook was immediately saving the old React state back to localStorage on component mount, overwriting the freshly imported data before it could be read. Added `hasMounted` state tracking to prevent this overwrite on initial render.

### Changed
- **Gates Page Dynamic Day Text**: Updated all hardcoded "7-day" references to use dynamic text based on each gate's actual `requiredDays` property:
  - Gate entry toast now shows the correct number of days (e.g., "Your 10-day challenge has begun!")
  - Header description changed from "7-day commitment challenges" to "Multi-day commitment challenges"
  - System notice updated from "7 consecutive days" to "required consecutive days"
  - This properly reflects that different gates have different duration requirements (7, 10, 12, or 14 days)

## [1.17.0] - 2025-12-09

### Changed
- **Gates Redesign**: Each gate rank now has distinct difficulty mechanics
  - **E-Rank**: 7 days, 0 habits required (all quests only)
  - **D-Rank**: 7 days, 1 habit required daily
  - **C-Rank**: 10 days, 2 habits required daily
  - **B-Rank**: 10 days, 3 habits required daily
  - **A-Rank**: 12 days, 4 habits required daily
  - **S-Rank**: 14 days, 5 habits required daily
  - Duration and habit requirements now clearly displayed on each gate card
  - Simplified challenge logic - uses unified requiredHabits system instead of per-gate checks

## [1.16.0] - 2025-12-09

### Added
- **Quest Auto-Sort**: Completed quests now automatically move to the bottom of the list
  - Pending quests stay at the top for easier access
  - Smooth fade animation when quests reorder
  - Completed quests appear slightly faded to visually distinguish them
- **Quest Drag & Drop Reordering**: Manually prioritize quests by dragging
  - Grip handle on each quest card for intuitive drag interaction
  - Works with touch and mouse
  - Order persists in localStorage
  - Visual feedback during drag (scale and shadow effects)

### Added
- **Data Import/Export System**: Full backup and restore functionality in Customize page
  - Export all data (stats, quests, habits, gates, rewards, challenges, streaks, XP history) to JSON file
  - Import data from backup file to restore progress
  - Includes version tracking for future compatibility
  - Located in new "Data Management" section in Customize page

### Fixed
- **Necromancer Hard Mode Penalty**: No longer deletes custom quests and rewards
  - Previously wiped all quests completely, now only resets completion status
  - Preserves user-created quests, rewards, and habits structure
  - Resets streak data as intended but keeps data configurations
- **Necromancer Confirmation Text**: Removed confusing full-stop from confirmation phrase
  - Changed from "I accept this contract." to "I accept this contract"
  - Users no longer get stuck trying to match the exact punctuation

## [1.15.1] - 2025-12-04

### Fixed
- **Social Media Preview Image**: Regenerated OG image to accurately represent the actual app UI
  - Previous AI-generated image looked nothing like the app
  - New image shows: SYSTEM branding, Hunter profile, Status Window, Level, E-Rank, stat bars, currency displays
  - Proper Solo Leveling dark theme with cyan/magenta accents

## [1.15.0] - 2025-12-04

### Added
- **Custom Favicon**: Generated AI favicon with crossed katanas in purple-black shadow aura (Sung Jinwoo inspired)
- **Web App Manifest**: Added manifest.json for Android home screen icon support
- **Custom Social Media Preview**: Generated OG image showing Solo Leveling System UI for link previews

### Changed
- **FirstTimeSetup Text**: Updated "cannot be changed later" to "you can change it later in Customize Profile"
- **PlayerProfileCard Avatar Display**: Now shows custom profile picture if set, otherwise shows class emoji
  - Fixed emoji mapping to match class IDs (fighter, tanker, mage, assassin, ranger, healer, necromancer)
  - Custom uploaded images (base64 data URLs) now properly display in the avatar circle

### Fixed
- **Profile Picture Not Showing**: Fixed bug where custom profile pictures from Customize weren't displaying in Awakening page
- **Browser Tab Icon**: Replaced Lovable favicon with custom Solo Leveling favicon
- **Android Home Screen Icon**: Added web manifest for proper PWA icon display

### Technical
- Updated index.html with new favicon, apple-touch-icon, manifest, and theme-color meta tags
- Created public/manifest.json for PWA support
- Generated public/favicon.png (512x512) and public/og-image.png (1200x630)
- Updated PlayerProfileCard to use AvatarImage component for custom images

## [1.14.0] - 2025-12-04

### Changed
- **Renamed "Stat Points" to "Ability Points"**: Updated terminology throughout the app
  - LevelUpAnimation: Shows "Ability Points Earned" instead of "Stat Points Earned"
  - usePlayerStats: Level up toast says "Ability Points" instead of "Stat Points"
  - Awakening page: Shows "Ability Points Available" instead of "Stat Points Available"

### Fixed
- **Necromancer Mode Modal Overflow**: Modal is now scrollable with max-height of 90vh
  - Previously the modal was too large and cut off on smaller screens
  - Users can now scroll to see all content and access buttons

### Added
- **Separate Analyze/Accept Quest Buttons**: Quest creation now has two distinct actions
  - "Analyze Quest" button appears first for users to analyze their quest description
  - "Accept Quest" button appears only after analysis is complete
  - Removed auto-analyze on blur behavior for better user control
  - Clearer workflow: type description → analyze → accept

## [1.13.0] - 2025-12-04

### Fixed
- **Challenge Reward Exploit**: Fixed bug allowing users to claim challenge rewards multiple times by reloading the page
  - Implemented claim tracking system using localStorage with period-based keys (daily/weekly)
  - Challenges now check if already claimed for current period before allowing claim
  - New challenges only generate if no active/completed challenge exists AND not already claimed for period
  - Prevents duplicate reward farming through page reloads

## [1.12.0] - 2025-12-03

### Added
- **Necromancer Streak Failure Detection**: Automatic penalty system when streak breaks during active challenge
  - Normal Mode: 5% loss of all major stats (XP, Gold, Credits, Gems, STR, AGI, INT, VIT, SEN)
  - Hard Mode: Complete account reset (all stats, XP, currencies, titles, classes wiped)
  - Challenge automatically resets to pending state for reattempt
  - Toast notifications inform user of penalties applied
- **Hard Mode Reattempt**: Added "May reattempt the challenge anytime" text to Hard Mode description

### Changed
- **Necromancer Mode Modal Legibility**: Improved text readability throughout
  - Increased heading sizes from text-xl to text-2xl with tracking-wide
  - Increased body text from text-xs/text-sm to text-base
  - Larger icons (w-10 h-10) and padding (p-3) for mode indicators
  - Increased button height to h-12 with text-base font
  - Better spacing between list items (space-y-2)
  - Clearer visual hierarchy with font-medium and font-bold distinctions
  - Larger warning icons and improved emphasis on critical text

## [1.11.0] - 2025-12-03

### Added
- **Futuristic Sound Effects**: Comprehensive audio feedback system using Web Audio API
  - `playClick()`: Subtle futuristic click for all interactive elements
  - `playSuccess()`: Rewarding "ker-ching" sound for quest completion and purchases
  - `playError()`: Error feedback for failed actions
  - `playHover()`: Subtle hover effect sound
  - `playLevelUp()`: Achievement fanfare for level ups and major unlocks
- **Sound Integration**: Applied sounds throughout the application
  - All buttons emit click sounds on interaction
  - Quest completion triggers success sound
  - Reward Centre purchases play success/error sounds
  - XP Boost Shop purchases play success/error sounds
  - Card Frame Shop unlocks play success/error sounds
  - Level up animations trigger level up sound
  - Necromancer class unlock plays level up sound

### Added
- **Necromancer Unlock Popup**: Global popup notification when 90-day streak is achieved
  - Appears on every page (except /quests) when challenge is complete but unclaimed
  - "Claim Now" button navigates to Quests page
  - "Remind Me Later" dismisses popup temporarily
  - Purple-themed design matching Necromancer aesthetic

### Added
- **Path of the Necromancer Dual-Mode System**: Complete legendary challenge overhaul
  - Challenge is now pending by default - must be manually accepted
  - Side-by-side mode selection modal for comparing options
  
- **Normal Mode (Recommended)**:
  - Safe Attempt with moderate penalties on failure
  - Streak reset + 5% loss of major stats on failure
  - Keep all titles, classes, progress, frames
  - May reattempt anytime
  - Reward: Unlock Necromancer Class only
  
- **Hard Mode (Serious Users Only)**:
  - High-Risk Contract with severe penalties
  - ALL progress resets on failure (stats, XP, currencies, titles, classes)
  - Only card frames are preserved
  - Requires typed confirmation: "I accept this contract."
  - Rewards: Necromancer Class + 10 Levels + 20 all stats + 100 Credits + 5 Gold + 5 Gems

### Technical
- Created `NecromancerModeModal.tsx` component for mode selection
- Extended `LegendaryChallenge` interface with `mode` and `acceptedDate` fields
- Added `NecromancerMode` type ("normal" | "hard" | null)
- Added `NECROMANCER_REWARDS` constant for mode-specific rewards
- New penalty methods in `usePlayerStats`:
  - `applyNecromancerNormalPenalty()`: 5% stat reduction
  - `applyNecromancerHardPenalty()`: Complete reset
  - `applyHardModeRewards()`: Hard mode completion bonuses

## [1.10.2] - 2025-12-02

### Changed
- **Customize Page Auto-Save**: Changes now save automatically with 300ms debounce - no need to click save button
- Removed manual save button, replaced with "Changes are saved automatically" indicator

## [1.10.1] - 2025-12-02

### Fixed
- **Card Frame Shop Layout**: Removed nested scroll area to prevent scroll-within-scroll issue
- **Frame Preview Cards**: Adjusted card heights to fit frames properly without excessive empty space
- **Frame Preview Centering**: Changed previews to be vertically centered instead of top-aligned
- **Individual Frame Positioning**: Updated frameInset system to support per-side values (top, right, bottom, left)
  - Shadow Monarch: Fixed position offset, widened on top/left/right
  - Demon Lord: Added more space on top to show name
  - Storm Caller: Added more space on top
  - Inferno Blaze: Shortened bottom overflow
  - Frozen Fortress: Shortened top and bottom overflow
  - Blood Reaper: Shortened top and bottom overflow
  - Demon Lord: Shortened top and bottom overflow
  - Emerald Guardian: Shortened bottom overflow
  - Celestial Divine: Widened left and right sides
  - Storm Caller: Shortened all 4 sides

### Technical
- Changed `frameInset` from single number to object with `{ top, right, bottom, left }` properties
- Updated `StatsCardFrame.tsx` to apply individual inset values per side
- Removed `ScrollArea` wrapper from `CardFrameShop.tsx`

## [1.10.0] - 2025-11-29

### Changed - Immersive 3D Card Border Redesign
- **Complete overhaul of card edge effects** with thick, textured borders wrapping entire cards
- **Ice Theme (Frozen Fortress)**: 
  - Actual frozen ice texture with crystalline diamond patterns
  - Hanging icicles from all four sides (25 per top/bottom, 20 per left/right)
  - Frost particles floating in the border area
  - Shimmer animation for ice crystal effect
- **Shadow Theme (Shadow Monarch)**:
  - Purple flames/smoke engulfing all borders (inspired by reference images)
  - Multiple layered smoke effects with radial gradients
  - 30+ animated flame tendrils per side with varying heights
  - Shadow particles floating upward
  - Pulsing glow animation
- **Fire Theme (Inferno Blaze, Blood Reaper)**:
  - Raging fire texture with actual flame spikes
  - 20 animated flame spikes per top/bottom edge
  - 15 horizontal flame spikes per side
  - Multiple blur layers for depth
  - Dynamic flicker animation with scale variation
- **Nature Theme (Forest Warden)**:
  - Organic vine borders wrapping all sides
  - SVG vine paths with flowing curves
  - 20+ leaf elements with rotation and pulse animations
  - Green glow effects matching forest theme
- **Cosmic Theme (Cosmic Voyager)**:
  - Nebula effects with multi-color gradients (purple, blue, pink)
  - 40+ twinkling stars per border
  - 3 shooting stars with trail effects
  - Cosmic pulse animation for depth
- **Demon Theme (Demon Lord)**:
  - Dark fire and smoke with red glow
  - 35+ dark flame tendrils with black smoke
  - Ember particles rising from borders
  - Mix-blend-mode screen for authentic demon fire effect
- **Electric Theme (Storm Caller)**:
  - Lightning bolts wrapping all edges
  - 12 animated SVG lightning paths per top/bottom
  - 60 electric particles along borders
  - Rapid spark animation
- **Enhanced Animations**: Updated CSS keyframes for more realistic effects
  - flameFlicker now includes scaleX variation for wavering flames
  - shadowPulse includes scale transform for breathing effect
  - shootingStar has diagonal trajectory
  - demonSmoke includes rotation for swirling effect

### Technical
- Complete rewrite of `src/components/CardEdges.tsx`
- Removed decorative SVG shapes, replaced with thick textured border overlays
- Uses CSS gradients, blur filters, and animations for realistic textures
- Multiple layered div elements for depth and realism
- Optimized animation delays for staggered effects
- Updated `src/index.css` keyframe animations

## [1.9.0] - 2025-11-28

### Added
- **Anime-Style Card Edges**: Custom SVG-based edge decorations matching each frame theme
  - Sharp geometric edges for common/default frames
  - Flame-like edges for fire/inferno themes (Inferno Blaze, Blood Reaper)
  - Ice shard edges for frozen themes (Frozen Fortress)
  - Shadow wispy tendrils for dark themes (Shadow Monarch)
  - Ornate decorative borders for celestial themes (Celestial Divine)
  - Electric lightning bolt edges for storm themes (Storm Caller)
- **Thematic Visual Elements**: Dynamic decorative effects based on card frame
  - Animated flames with pulse effects for fire frames
  - Floating ice crystals with shimmer animation for ice frames
  - Wispy shadow tendrils with float animation for shadow frames
  - Lightning streaks with pulse for electric frames
  - Twinkling stars for celestial frames
  - Energy pulses for emerald/energy frames
- **Share Animation Effects**: Sparkle and glow animations when sharing cards
  - 30 sparkle particles with random colors and positions
  - Radial glow wave effect
  - Smooth animation triggers before card capture
  - Visual feedback for share/download actions
- **4K Download Quality**: Ultra high-resolution card exports
  - 4x scale factor for crystal-clear image quality
  - Maximum PNG quality (1.0) for best results
  - Optimized file naming with "4K" suffix
  - Better for printing and high-resolution displays
- **Custom Profile Picture Support**: Upload your own character images
  - File upload with 2MB size limit and image type validation
  - Support for custom images alongside emoji avatars
  - Preview functionality before applying
  - Remove uploaded image option
  - Images stored as data URLs in localStorage
- **Pokemon-Style Card Redesign**: Complete visual overhaul of stats cards
  - Large character image area (like Pokemon/trading cards) occupying top 60% of card
  - Character images with holographic gradient overlays and glow effects
  - Stat bars with icons, progress bars, and animated fills
  - Cleaner, more professional card layout with better visual hierarchy
  - Character backgrounds with gradient effects matching avatar type
  - Title overlay at bottom of character area
  - Rounded corners (rounded-2xl) for authentic card feel

### Changed
- **Card Frame Definitions**: Extended interface with new style properties
  - Added `edgeStyle` property for custom edge rendering
  - Added `themeElements` for decorative element configuration
  - Each frame now has unique edge styling matching its theme
- **StatsCardFrame Component**: Integrated custom edges and theme elements
  - Renders appropriate SVG edges based on frame style
  - Dynamically generates theme-specific decorative elements
  - Better visual depth and anime-style presentation
- **ShareableStatsCard Component**: Enhanced with animations and quality
  - Animation overlay system with sparkles and glows
  - 4K capture functionality (scale: 4)
  - Disabled state during animation/capture
  - Better error handling and user feedback
  - Updated button labels to reflect 4K quality
- **Design System**: Added 4 new animation keyframes
  - `sparkle`: Scale and fade animation for sparkle particles
  - `wave`: Radial expanding glow wave effect
  - `float`: Smooth floating motion for atmospheric elements
  - `twinkle`: Star-like twinkling effect

### Technical
- Created `src/components/CardEdges.tsx` with SVG edge generation functions
- Added `renderThemeElements()` method in StatsCardFrame for dynamic decorations
- Updated `src/lib/cardFrames.ts` interface with edge and theme properties
- Enhanced `src/index.css` with new animation keyframes
- Improved html2canvas capture with higher scale and quality settings
- Added animation state management in ShareableStatsCard

## [1.8.0] - 2025-11-28

### Added
- **Pokemon-Style Card Frame System**: Collectible card designs for shareable stats
  - 8 unique card frame designs with 5 rarity tiers (Common, Rare, Epic, Legendary, Mythic)
  - Each frame features unique border gradients, glow effects, and corner styles
  - Card frames unlock from Reward Centre using credits (150-1000 credits)
  - Frame rarities: Common (free), Rare (150-200), Epic (300), Legendary (500), Mythic (1000)
- **Advanced Card Animations**: Multiple dynamic visual effects
  - Pulse, Shimmer, Glow, Particles, and Holographic animations
  - Canvas-based particle system with 30 floating particles for particle animation
  - Animated stat numbers with smooth scaling effects
  - Custom CSS keyframes for shimmer, glow, and holographic effects
- **Card Frame Shop**: New Reward Centre tab for frame purchasing
  - Browse all available card frames with preview functionality
  - Live preview dialog showing card with current player stats
  - Rarity badges with color-coded indicators
  - Purchase frames using credits earned from gameplay
  - Lock indicators for unavailable frames
- **Card Frame Customization**: Enhanced profile customization
  - Select from unlocked card frames in Customize page
  - Preview each frame with live player stats before applying
  - Frame selection persists across app
  - Visual indicators for locked/unlocked frames
- **Redesigned Stats Card**: Pokemon card-inspired layout
  - 2:3 aspect ratio card design (420px max width)
  - Dynamic styling based on selected frame
  - Corner decorations matching frame style (sharp/rounded/ornate/geometric)
  - Background overlays with frame-specific patterns and gradients
  - Compact stat display optimized for card format (3-letter abbreviations)
  - Glowing effects and shadows matching frame colors
  - Enhanced visual hierarchy with better spacing

### Changed
- **ShareableStatsCard Component**: Refactored to use new StatsCardFrame component
- **Rewards Page**: Added "Card Frames" tab between Rewards and XP Boosts (3 tabs total)
- **Customize Page**: Added card frame selection section with preview dialogs
- **Storage System**: Extended PlayerStats interface with `selectedCardFrame` and `unlockedCardFrames` properties
- **Design System**: Added custom animation keyframes (shimmer, glow, holographic, stat-number)

### Technical
- Created `src/lib/cardFrames.ts` with CARD_FRAMES definitions and getRarityColor utility
- Created `src/components/StatsCardFrame.tsx` for Pokemon-style card rendering with animations
- Created `src/components/CardFrameShop.tsx` for frame purchasing and preview interface
- Updated `src/index.css` with 4 new animation keyframes
- Storage migration automatically adds default frame to existing users
- Frame preview uses Dialog component for modal display

## [1.7.0] - 2025-11-27

### Fixed
- **Gate Failure Penalties**: Fixed bug where gate abandonment penalties weren't being applied to player stats
  - Penalties now properly deduct: -10% Credits, -10% XP, -5 all stats, -1 level
  - Applied with timeout to ensure proper state synchronization
- **Reward Centre Navigation**: Fixed button in Awakening page to properly navigate to Reward Centre tab
  - Now uses React Router navigation with automatic tab switching
  - User lands directly on Rewards tab instead of Daily Quests

### Changed
- **Credits Conversion Rate**: Updated from 2 XP = 1 credit to 10 XP = 1 credit
  - Makes credit economy more balanced and rewards more valuable
  - Quest completion now awards credits at 1/10th of XP value

### Added
- **Daily/Weekly Challenges System**: New separate challenge system with high-value rewards
  - Daily challenges: Complete X quests, achieve habits, perfect completion (200-300 XP rewards)
  - Weekly challenges: Complete 50 quests, maintain 7-day streak, clear gates, earn XP (1500-2500 XP rewards)
  - Auto-generates new challenges when previous ones expire or complete
  - Tracks progress automatically based on player activity
  - Rewards include XP, Gold, Gems, and Credits
  - New "Challenges" tab in Quests page
- **XP Boost Shop**: Purchase temporary XP multipliers with Gold and Gems
  - Minor Boost (1.5x): 200 Gold for 30 mins, 350 Gold + 5 Gems for 60 mins
  - Major Boost (2x): 400 Gold for 30 mins, 700 Gold + 10 Gems for 60 mins
  - Legendary Boost (3x): 25 Gems for 30 minutes
  - Active boost display with countdown timer
  - Only one boost can be active at a time
  - New "XP Boosts" tab in Quests page
- **Resource Earning Guide**: Added clear information on how to earn Gold and Gems
  - Gold: Earned from completing Gates (boss challenges)
  - Gems: Earned from completing Weekly Challenges
  - Info card displayed in XP Boost Shop

### Technical
- Added `challenges.ts` library for challenge generation and management
- Created `ChallengesPanel.tsx` component for challenge UI
- Created `XPBoostShop.tsx` component for boost purchasing system
- Extended Quests page with 4 tabs: Daily Quests, Challenges, XP Boosts, Rewards
- Challenge progress automatically tracked via storage monitoring
- Boost expiration tracked with localStorage persistence

## [1.6.0] - 2025-11-27

### Changed
- **Rank System**: E-Rank now persists until Level 5, D-Rank starts at Level 6 (previously Level 10)
- **Gate Restrictions**: Only one gate can be active at a time to prevent parallel challenges
- **Statistics Layout**: Moved Gold, Gems, and Credits from Status Window to Statistics section
- **Shadow Dungeon Gate**: Now unlocks at Level 6 instead of Level 5

### Added
- **Automatic Gate Progress Tracking**: Gate daily challenges now auto-complete when requirements are met
  - E-Rank (Goblin Cave): Auto-marks when all daily quests are complete
  - D-Rank (Shadow Dungeon): Auto-marks when all quests + 1 habit complete
  - C-Rank (Temple of Chaos): Auto-marks when all quests complete + 7-day streak maintained
  - B-Rank (Frozen Citadel): Auto-marks when all quests + all active habits complete
  - A-Rank & S-Rank: Auto-marks on 100% completion
  - System automatically checks progress when stats update
  - Auto-completes gate when all 7 days are done
- **Gate Failure Penalties**: Failing or abandoning a gate now applies severe penalties:
  - -10% Credits (rounded)
  - -10% Total XP (rounded)
  - -5 to each stat (Strength, Agility, Intelligence, Vitality, Sense)
  - -1 Level demotion (additional to level loss from XP reduction)
  - Total power reduction of 25
  - Stats cannot go below 10 minimum
  - New `applyGatePenalty()` method in usePlayerStats hook
- **Reward Cost Minimum**: Custom rewards must cost at least 20 credits
  - Validation on reward creation
  - Input field enforces minimum value
  - Helper text shows minimum requirement
- **Habit Statistics Panel**: Comprehensive analytics view with visual charts
  - Active habits count
  - Win rate percentage across completed habits
  - Best streak across all habits (calculated from completion history)
  - Total days tracked across all habits
  - Win/Loss/In Progress progress bars with percentages
  - Completion rate by individual habit with colored progress bars
  - Average completion rate for active habits
  - New fourth tab "Stats" in Habits page
- **Reward Centre Access**: Direct button in Statistics section to open Reward Centre

### Fixed
- Gate auto-completion now properly triggers when all 7 days are marked complete
- Gate challenge descriptions now clarify auto-completion behavior
- System warning updated to mention one-gate-at-a-time restriction and penalties

### Technical
- Added HabitStatistics.tsx component for analytics visualization
- Extended usePlayerStats hook with applyGatePenalty method
- Gates.tsx now monitors quest and habit completion via storage for auto-marking
- Enhanced gate status checking with more robust logic
- Default reward creditCost changed from 50 to 50 with 20 minimum

## [1.5.0] - 2025-11-27

### Added
- **Gates System**: Complete boss challenge system
  - 6 gates from E-Rank to S-Rank with escalating difficulty
  - 7-day commitment challenges with daily completion tracking
  - Rank-based visual styling with glowing effects
  - Loss counter that tracks failures
  - Progressive unlock system based on player level (E-Rank at Lv1, S-Rank at Lv100)
  - Dramatic lore text and system warnings for each gate
  - Special rewards: massive XP, Gold, and exclusive titles
  - Boss names: Goblin Chieftain, Shadow Beast, Chaos Knight, Ice Monarch, Red Dragon, Shadow Monarch
  - Status tracking: locked, active, completed, failed
  - Rechallenge system after failure
  - Daily challenge requirements that scale with difficulty
  
### Changed
- **Typography Enhancement**: All major headings now use Cinzel font
  - Status Window, Statistics, Daily Quests, Reward Centre, Gates, Habits, XP History
  - Creates consistent imperial/authoritative aesthetic throughout app
  - Matches Solo Leveling manhwa theme
  
### Technical
- Added Gate interface to storage.ts with comprehensive data structure
- Implemented gate state management with localStorage persistence
- Auto-unlock system checks player level on mount and level changes
- Default gates preloaded on first visit

## [1.4.0] - 2025-11-27

### Added
- **Credits System**: New currency for Reward Centre
  - Quests now award Credits (50% of XP value)
  - Credits displayed in Awakening page alongside Gold and Gems
  - Credits migration for existing saves
- **Reward Centre**: Complete reward management system
  - Create custom rewards with Credit costs
  - Default rewards included (1 Hour Free Time, Game for 30 mins, etc.)
  - Claim rewards by spending Credits
  - Reset claimed rewards
  - Delete unwanted rewards
  - Integrated as second tab in Quests page
- **Timezone Selector Overhaul**: Continuous scrolling UTC offset list
  - All timezones from UTC-11:00 to UTC+14:00
  - Includes half-hour offsets (UTC+05:30, UTC+09:30, etc.)
  - Organized chronologically by offset for easy navigation
  - Scrollable list with offset labels

### Changed
- **Status → Awakening**: Renamed page to match Solo Leveling theme
  - Updated navigation label
  - Updated route in App.tsx
  - Updated tab label
- **Total XP Display**: Moved from Status Window to Statistics card
  - Now prominently displayed below radar chart
  - Better visibility and more logical placement

### Technical
- Added credits field to PlayerStats interface
- Credits stored in localStorage with migration support
- Rewards stored separately in localStorage

## [1.3.0] - 2025-11-26

### Added
- **Automatic Daily Quest Reset**: Quests now reset at midnight based on user's timezone
  - Prevents manual reset exploitation for stats/points farming
  - Next reset countdown displayed to users
  - Uses IANA timezone database (e.g., "America/New_York")
- **Timezone Selection**: Users can choose their preferred timezone
  - Located in Customize page
  - Affects daily quest reset timing
  - Defaults to system timezone

### Changed
- Removed manual "Reset Quests" button to prevent exploitation
- Quest reset is now fully automatic and timezone-aware

### Technical
- Added UserSettings interface in storage.ts for timezone preference
- Implemented timezone-aware date comparison in dateUtils.ts
- Quest reset logic moved to useEffect with interval checking
