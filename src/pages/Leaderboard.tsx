import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HunterProfileModal } from '@/components/HunterProfileModal';
import { HunterAvatar } from '@/components/HunterAvatar';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Medal, Crown, Globe, Calendar, Target, User, TrendingUp,
  Swords, Flame, Sparkles, Shield, Star, Zap, ChevronDown, Hash,
  ArrowRight, UserCircle, Clock
} from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  hunterName: string;
  avatar?: string;
  level: number;
  totalXp: number;
  weeklyXp: number;
  playerRank: string;
  power: number;
  isCurrentUser: boolean;
}

// Rank color system - consistent theming
const RANK_COLORS: Record<string, { 
  bg: string; 
  border: string; 
  text: string; 
  glow: string;
  borderColor: string;
  glowColor: string;
}> = {
  'E-Rank': { 
    bg: 'from-slate-700/40 to-slate-900/60', 
    border: 'border-slate-500', 
    text: 'text-slate-400', 
    glow: 'shadow-slate-500/20',
    borderColor: 'slate-500',
    glowColor: 'rgba(100, 116, 139, 0.3)'
  },
  'D-Rank': { 
    bg: 'from-blue-800/40 to-blue-950/60', 
    border: 'border-blue-500', 
    text: 'text-blue-400', 
    glow: 'shadow-blue-500/30',
    borderColor: 'blue-500',
    glowColor: 'rgba(59, 130, 246, 0.3)'
  },
  'C-Rank': { 
    bg: 'from-emerald-800/40 to-emerald-950/60', 
    border: 'border-emerald-500', 
    text: 'text-emerald-400', 
    glow: 'shadow-emerald-500/30',
    borderColor: 'emerald-500',
    glowColor: 'rgba(16, 185, 129, 0.3)'
  },
  'B-Rank': { 
    bg: 'from-cyan-800/40 to-cyan-950/60', 
    border: 'border-cyan-500', 
    text: 'text-cyan-400', 
    glow: 'shadow-cyan-500/40',
    borderColor: 'cyan-500',
    glowColor: 'rgba(6, 182, 212, 0.3)'
  },
  'A-Rank': { 
    bg: 'from-purple-800/40 to-purple-950/60', 
    border: 'border-purple-500', 
    text: 'text-purple-400', 
    glow: 'shadow-purple-500/40',
    borderColor: 'purple-500',
    glowColor: 'rgba(168, 85, 247, 0.4)'
  },
  'S-Rank': { 
    bg: 'from-yellow-700/40 to-yellow-950/60', 
    border: 'border-yellow-500', 
    text: 'text-yellow-400', 
    glow: 'shadow-yellow-500/50',
    borderColor: 'yellow-500',
    glowColor: 'rgba(234, 179, 8, 0.4)'
  },
};

const RANK_BADGE_COLORS: Record<string, string> = {
  'E-Rank': 'bg-slate-800/80 text-slate-400 border-slate-500/60',
  'D-Rank': 'bg-blue-900/80 text-blue-400 border-blue-500/60',
  'C-Rank': 'bg-emerald-900/80 text-emerald-400 border-emerald-500/60',
  'B-Rank': 'bg-cyan-900/80 text-cyan-400 border-cyan-500/60',
  'A-Rank': 'bg-purple-900/80 text-purple-400 border-purple-500/60',
  'S-Rank': 'bg-yellow-900/80 text-yellow-400 border-yellow-500/60',
};

const RANK_ICONS: Record<string, React.ReactNode> = {
  'E-Rank': <Shield className="h-4 w-4" />,
  'D-Rank': <Shield className="h-4 w-4" />,
  'C-Rank': <Swords className="h-4 w-4" />,
  'B-Rank': <Swords className="h-4 w-4" />,
  'A-Rank': <Zap className="h-4 w-4" />,
  'S-Rank': <Crown className="h-4 w-4" />,
};

const RANK_ORDER = ['E-Rank', 'D-Rank', 'C-Rank', 'B-Rank', 'A-Rank', 'S-Rank'];

type SortBy = 'level' | 'xp' | 'power';
type LeaderboardType = 'global' | 'weekly' | 'rank';

// Animated counter hook
const useCountUp = (end: number, duration: number = 1000, trigger: boolean = true) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!trigger) return;
    
    let startTime: number;
    let animationFrame: number;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, trigger]);
  
  return count;
};

// Podium Card Component for Top 3
const PodiumCard = ({ 
  entry, 
  position, 
  onClick 
}: { 
  entry: LeaderboardEntry; 
  position: 1 | 2 | 3;
  onClick: () => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const powerCount = useCountUp(entry.power, 1000);
  
  const positionConfig = {
    1: {
      height: 'h-64 md:h-72',
      bgGradient: 'radial-gradient(ellipse at center, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.1) 30%, transparent 70%)',
      borderColor: 'border-yellow-500',
      glowStyle: '0 0 40px rgba(234, 179, 8, 0.4)',
      icon: <span className="text-4xl md:text-5xl animate-pulse">👑</span>,
      avatarSize: 'h-20 w-20 md:h-24 md:w-24',
      avatarBorder: 'border-4 border-yellow-500',
      nameSize: 'text-xl md:text-2xl',
      powerSize: 'text-lg md:text-xl',
      powerColor: 'text-yellow-400',
      badgeColor: 'from-yellow-500 to-yellow-600',
      delay: 0,
    },
    2: {
      height: 'h-52 md:h-60',
      bgGradient: 'radial-gradient(ellipse at center, rgba(148, 163, 184, 0.2) 0%, rgba(148, 163, 184, 0.1) 30%, transparent 70%)',
      borderColor: 'border-slate-400',
      glowStyle: '0 0 30px rgba(148, 163, 184, 0.3)',
      icon: <span className="text-3xl md:text-4xl">🥈</span>,
      avatarSize: 'h-16 w-16 md:h-20 md:w-20',
      avatarBorder: 'border-3 border-slate-400',
      nameSize: 'text-lg md:text-xl',
      powerSize: 'text-base md:text-lg',
      powerColor: 'text-slate-300',
      badgeColor: 'from-slate-400 to-slate-500',
      delay: 0.1,
    },
    3: {
      height: 'h-48 md:h-56',
      bgGradient: 'radial-gradient(ellipse at center, rgba(180, 83, 9, 0.2) 0%, rgba(180, 83, 9, 0.1) 30%, transparent 70%)',
      borderColor: 'border-amber-700',
      glowStyle: '0 0 25px rgba(180, 83, 9, 0.3)',
      icon: <span className="text-3xl md:text-4xl">🥉</span>,
      avatarSize: 'h-16 w-16 md:h-20 md:w-20',
      avatarBorder: 'border-3 border-amber-700',
      nameSize: 'text-lg md:text-xl',
      powerSize: 'text-base md:text-lg',
      powerColor: 'text-amber-500',
      badgeColor: 'from-amber-600 to-amber-700',
      delay: 0.2,
    },
  };
  
  const config = positionConfig[position];
  const rankColors = RANK_COLORS[entry.playerRank] || RANK_COLORS['E-Rank'];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: config.delay, type: 'spring', bounce: 0.3 }}
      className={`relative ${config.height} rounded-2xl border-3 ${config.borderColor} p-4 md:p-6 cursor-pointer overflow-hidden`}
      style={{ 
        background: config.bgGradient,
        boxShadow: isHovered ? config.glowStyle.replace('0.4', '0.6').replace('0.3', '0.5') : config.glowStyle,
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.05, y: -4 }}
    >
      {/* Rank number badge */}
      <div className={`absolute top-3 right-3 md:top-4 md:right-4 h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-br ${config.badgeColor} flex items-center justify-center shadow-lg`}>
        <span className="text-white font-bold text-lg md:text-2xl">#{position}</span>
        {position === 1 && (
          <div className="absolute inset-0 animate-ping rounded-full bg-yellow-500/30" />
        )}
      </div>
      
      {/* Content */}
      <div className="flex flex-col items-center justify-center h-full gap-2 md:gap-3">
        {/* Medal/Crown icon */}
        <motion.div
          animate={position === 1 ? { rotate: [0, 5, -5, 0] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {config.icon}
        </motion.div>
        
        {/* Avatar */}
        <div
          className={cn(
            'relative aspect-square rounded-full p-1',
            config.avatarSize,
            config.avatarBorder,
            'bg-slate-900/40'
          )}
          style={{ boxShadow: config.glowStyle }}
        >
          {position === 1 && (
            <div className="absolute inset-0 rounded-full bg-yellow-500/15 animate-pulse" />
          )}
          <div className="relative z-10 h-full w-full rounded-full overflow-hidden bg-slate-800">
            <HunterAvatar
              avatar={entry.avatar}
              hunterName={entry.hunterName}
              size={position === 1 ? 'xl' : 'lg'}
              showBorder={false}
              className="h-full w-full"
            />
          </div>
        </div>
        
        {/* Name */}
        <h3 className={`${config.nameSize} font-cinzel font-bold text-white text-center truncate max-w-full`}>
          {entry.hunterName}
        </h3>
        
        {/* Rank badge */}
        <Badge className={`${RANK_BADGE_COLORS[entry.playerRank]} text-xs`}>
          {RANK_ICONS[entry.playerRank]}
          <span className="ml-1">{entry.playerRank}</span>
        </Badge>
        
        {/* Power stat */}
        <div className={`flex items-center gap-1 font-bold ${config.powerSize} ${config.powerColor}`}>
          <Zap className="h-4 w-4 md:h-5 md:w-5" />
          <span>{powerCount.toLocaleString()}</span>
        </div>
        
        {/* Level and XP */}
        <p className="text-xs md:text-sm text-muted-foreground">
          Lv. {entry.level} · {entry.totalXp.toLocaleString()} XP
        </p>
        
        {/* Hover text */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          className="text-xs text-cyan-400 flex items-center gap-1"
        >
          View Profile <ArrowRight className="h-3 w-3" />
        </motion.span>
      </div>
    </motion.div>
  );
};

// Hunter Row Component for positions 4+
const HunterRow = ({ 
  entry, 
  index,
  onClick,
  isWeekly = false,
}: { 
  entry: LeaderboardEntry; 
  index: number;
  onClick: () => void;
  isWeekly?: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const rankColors = RANK_COLORS[entry.playerRank] || RANK_COLORS['E-Rank'];
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`relative flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 md:py-4 rounded-lg cursor-pointer transition-all duration-200 border-l-4 ${rankColors.border}`}
      style={{
        backgroundColor: isHovered ? 'rgba(30, 41, 59, 0.5)' : 'rgba(30, 41, 59, 0.3)',
        transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
        boxShadow: isHovered && ['S-Rank', 'A-Rank', 'B-Rank'].includes(entry.playerRank) 
          ? `0 0 20px ${rankColors.glowColor}` 
          : 'none',
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Rank position badge */}
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
        <span className={`text-sm md:text-base font-bold ${rankColors.text}`}>
          {entry.rank}
        </span>
      </div>
      
      {/* Avatar */}
      <div className={`relative h-10 w-10 md:h-12 md:w-12 rounded-full border-2 ${rankColors.border} overflow-hidden flex-shrink-0 bg-slate-800 flex items-center justify-center`}>
        <HunterAvatar 
          avatar={entry.avatar} 
          hunterName={entry.hunterName} 
          size="lg"
          showBorder={false}
          className="w-full h-full"
        />
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-semibold text-sm md:text-base truncate ${entry.isCurrentUser ? 'text-primary' : 'text-white'}`}>
            {entry.hunterName}
          </span>
          {entry.isCurrentUser && (
            <Badge variant="outline" className="text-xs border-primary text-primary bg-primary/10">
              YOU
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge className={`${RANK_BADGE_COLORS[entry.playerRank]} text-xs px-2 py-0.5`}>
            {entry.playerRank}
          </Badge>
          <span className="text-xs text-cyan-400 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {entry.power}
          </span>
          {isWeekly && (
            <span className="text-xs text-purple-400 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +{entry.weeklyXp.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      
      {/* Stats */}
      <div className="text-right flex-shrink-0">
        <div className="font-bold text-base md:text-lg text-white">
          Lv. {entry.level}
        </div>
        <div className="text-xs text-muted-foreground">
          {entry.totalXp.toLocaleString()} XP
        </div>
      </div>
      
      {/* View profile arrow */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : -10 }}
        className="flex-shrink-0"
      >
        <div className="p-2 rounded-lg bg-cyan-500/20">
          <ArrowRight className="h-4 w-4 text-cyan-400" />
        </div>
      </motion.div>
    </motion.div>
  );
};

const Leaderboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('global');
  const [sortBy, setSortBy] = useState<SortBy>('level');
  const [selectedRank, setSelectedRank] = useState<string>('E-Rank');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPosition, setUserPosition] = useState<number | null>(null);
  
  // Hunter profile modal state
  const [selectedHunter, setSelectedHunter] = useState<{ userId: string; hunterName: string } | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Calculate weekly reset countdown
  const getWeeklyResetCountdown = () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const hoursLeft = 24 - now.getUTCHours();
    return { days: daysUntilMonday - 1, hours: hoursLeft };
  };
  
  const resetCountdown = getWeeklyResetCountdown();

  useEffect(() => {
    fetchLeaderboard();
  }, [leaderboardType, sortBy, selectedRank, user]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: publicProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, hunter_name, avatar')
        .eq('is_public', true);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      const publicUserIds = publicProfiles?.map(p => p.user_id) || [];
      
      if (publicUserIds.length === 0) {
        setEntries([]);
        setUserPosition(null);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('player_stats')
        .select('user_id, level, total_xp, weekly_xp, rank, strength, agility, intelligence, vitality, sense')
        .in('user_id', publicUserIds);

      if (leaderboardType === 'rank') {
        query = query.eq('rank', selectedRank);
      }

      if (leaderboardType === 'weekly') {
        query = query.order('weekly_xp', { ascending: false });
      } else {
        switch (sortBy) {
          case 'level':
            query = query.order('level', { ascending: false }).order('total_xp', { ascending: false });
            break;
          case 'xp':
            query = query.order('total_xp', { ascending: false });
            break;
          case 'power':
            query = query.order('total_xp', { ascending: false });
            break;
        }
      }

      query = query.limit(100);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching leaderboard:', error);
        return;
      }

      const profileMap = new Map(publicProfiles?.map(p => [p.user_id, { name: p.hunter_name, avatar: p.avatar }]) || []);

      let leaderboardData: LeaderboardEntry[] = (data || []).map((entry, index) => {
        const power = entry.strength + entry.agility + entry.intelligence + entry.vitality + entry.sense;
        const profile = profileMap.get(entry.user_id);
        return {
          rank: index + 1,
          userId: entry.user_id,
          hunterName: profile?.name || 'Unknown Hunter',
          avatar: profile?.avatar,
          level: entry.level,
          totalXp: entry.total_xp,
          weeklyXp: entry.weekly_xp || 0,
          playerRank: entry.rank,
          power,
          isCurrentUser: user?.id === entry.user_id,
        };
      });

      if (sortBy === 'power' && leaderboardType !== 'weekly') {
        leaderboardData.sort((a, b) => b.power - a.power);
        leaderboardData = leaderboardData.map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));
      }

      setEntries(leaderboardData);
      const userEntry = leaderboardData.find(e => e.isCurrentUser);
      setUserPosition(userEntry?.rank || null);

    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleHunterClick = (entry: LeaderboardEntry) => {
    if (!entry.isCurrentUser) {
      setSelectedHunter({ userId: entry.userId, hunterName: entry.hunterName });
      setProfileModalOpen(true);
    }
  };

  const top3Entries = entries.slice(0, 3);
  const remainingEntries = entries.slice(3);

  return (
    <>
      <main className="md:pl-[70px] pt-16 pb-8 px-4 min-h-screen relative overflow-hidden">
        {/* Atmospheric background */}
        <div className="fixed inset-0 pointer-events-none">
          {/* Radial gradient overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)]" />
          
          {/* Floating particles */}
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: i % 2 === 0 ? 'hsl(186, 100%, 50%)' : 'hsl(270, 70%, 60%)',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: 0.1,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.05, 0.15, 0.05],
              }}
              transition={{
                duration: 4 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
          
          {/* Animated beam effect */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute h-[200%] w-px bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent"
              style={{ left: '20%', top: '-50%' }}
              animate={{ y: ['-50%', '50%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute h-[200%] w-px bg-gradient-to-b from-transparent via-purple-500/10 to-transparent"
              style={{ left: '80%', top: '-50%' }}
              animate={{ y: ['50%', '-50%'] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </div>

        <div className="max-w-5xl mx-auto space-y-6 relative z-10">
          {/* Epic Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative text-center space-y-4 py-8 md:py-12"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 rounded-3xl" />
            
            {/* Title with shields */}
            <div className="relative flex items-center justify-center gap-3 md:gap-6">
              {/* Left decorative line */}
              <div className="hidden md:flex items-center gap-2">
                <div className="h-px w-16 md:w-32 bg-gradient-to-r from-transparent to-cyan-500/50" />
              </div>
              
              {/* Left shield */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Shield 
                  className="h-8 w-8 md:h-12 md:w-12 text-cyan-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
                />
              </motion.div>
              
              {/* Title */}
              <h1 className="text-3xl md:text-5xl font-cinzel font-bold tracking-wider">
                <span className="bg-gradient-to-r from-cyan-400 to-cyan-600 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                  HUNTER RANKINGS
                </span>
              </h1>
              
              {/* Right shield */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              >
                <Shield 
                  className="h-8 w-8 md:h-12 md:w-12 text-cyan-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
                />
              </motion.div>
              
              {/* Right decorative line */}
              <div className="hidden md:flex items-center gap-2">
                <div className="h-px w-16 md:w-32 bg-gradient-to-l from-transparent to-cyan-500/50" />
              </div>
            </div>
            
            {/* Crossed swords */}
            <motion.div
              animate={{ rotate: [-3, 3, -3] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="flex justify-center"
            >
              <Swords className="h-6 w-6 md:h-8 md:w-8 text-cyan-400" />
            </motion.div>
            
            {/* Subtitle */}
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-sm md:text-base text-cyan-300/70"
            >
              Prove your strength among the world's greatest hunters
            </motion.p>
          </motion.div>

          {/* Your Position Card */}
          {user && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Card 
                className={`border-2 border-cyan-500/50 bg-gradient-to-r from-cyan-950/30 to-slate-900 overflow-hidden ${
                  userPosition && userPosition <= 3 ? 'animate-glow-pulse' : ''
                }`}
                style={{
                  boxShadow: userPosition && userPosition <= 3 
                    ? '0 0 30px rgba(6, 182, 212, 0.3)' 
                    : '0 0 15px rgba(6, 182, 212, 0.15)',
                }}
              >
                <CardContent className="py-4 md:py-6 px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
                  {/* Left - Label */}
                  <div className="flex items-center gap-3">
                    <UserCircle className="h-6 w-6 md:h-8 md:w-8 text-cyan-400" />
                    <span className="text-sm md:text-base text-slate-300">Your Position</span>
                  </div>
                  
                  {/* Center - Rank Badge */}
                  <div className="relative">
                    {userPosition ? (
                      <div 
                        className={`px-6 md:px-8 py-3 md:py-4 rounded-full font-bold text-2xl md:text-4xl text-white flex items-center gap-2 ${
                          userPosition <= 3 
                            ? 'bg-gradient-to-r from-cyan-500 to-cyan-600' 
                            : 'bg-slate-700'
                        }`}
                        style={{
                          boxShadow: userPosition <= 3 ? '0 0 25px rgba(6, 182, 212, 0.5)' : 'none',
                        }}
                      >
                        {userPosition === 1 && (
                          <motion.span 
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            👑
                          </motion.span>
                        )}
                        #{userPosition}
                      </div>
                    ) : (
                      <div className="px-6 py-3 rounded-full bg-slate-700 font-bold text-lg text-slate-400">
                        Unranked
                      </div>
                    )}
                    {userPosition && userPosition <= 3 && (
                      <div className="absolute inset-0 rounded-full animate-ping bg-cyan-500/20" />
                    )}
                  </div>
                  
                  {/* Right - Count */}
                  <div className="text-sm text-slate-400">
                    {userPosition ? `of ${entries.length} Hunters` : 'Complete quests to rank'}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Tabs value={leaderboardType} onValueChange={(v) => setLeaderboardType(v as LeaderboardType)}>
              <div className="bg-slate-800/30 rounded-lg p-1 mb-4">
                <TabsList className="grid w-full grid-cols-3 bg-transparent gap-2">
                  <TabsTrigger 
                    value="global" 
                    className="flex items-center gap-2 px-4 md:px-6 py-3 rounded-md text-sm font-medium transition-all data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 data-[state=active]:border-b-3 data-[state=active]:border-cyan-500 data-[state=active]:shadow-[0_4px_15px_rgba(6,182,212,0.3)] hover:bg-slate-700/50"
                  >
                    <Globe className="h-4 w-4" />
                    <span className="hidden sm:inline">Global</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="weekly" 
                    className="flex items-center gap-2 px-4 md:px-6 py-3 rounded-md text-sm font-medium transition-all data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 data-[state=active]:border-b-3 data-[state=active]:border-purple-500 data-[state=active]:shadow-[0_4px_15px_rgba(168,85,247,0.3)] hover:bg-slate-700/50"
                  >
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">Weekly</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="rank" 
                    className="flex items-center gap-2 px-4 md:px-6 py-3 rounded-md text-sm font-medium transition-all data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 data-[state=active]:border-b-3 data-[state=active]:border-cyan-500 data-[state=active]:shadow-[0_4px_15px_rgba(6,182,212,0.3)] hover:bg-slate-700/50"
                  >
                    <Target className="h-4 w-4" />
                    <span className="hidden sm:inline">By Rank</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Weekly Reset Banner */}
              {leaderboardType === 'weekly' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 py-3 px-6 mb-4 rounded-lg bg-purple-950/30 border border-purple-500/30"
                >
                  <Clock className="h-4 w-4 text-purple-400" />
                  <span className="text-sm text-purple-300">
                    Weekly Rankings Reset In: {resetCountdown.days} days {resetCountdown.hours} hours
                  </span>
                </motion.div>
              )}

              {/* Controls */}
              <div className="flex flex-wrap gap-4 mb-6">
                {leaderboardType !== 'weekly' && (
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                    <SelectTrigger className="w-[160px] bg-slate-800 border-slate-700 hover:border-cyan-500 focus:border-cyan-500 transition-colors">
                      <TrendingUp className="h-4 w-4 mr-2 text-cyan-400" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-cyan-500/30 backdrop-blur-sm">
                      <SelectItem value="level" className="hover:bg-cyan-500/20">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Level
                        </div>
                      </SelectItem>
                      <SelectItem value="xp" className="hover:bg-cyan-500/20">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          Total XP
                        </div>
                      </SelectItem>
                      <SelectItem value="power" className="hover:bg-cyan-500/20">
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4" />
                          Power
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {leaderboardType === 'rank' && (
                  <Select value={selectedRank} onValueChange={setSelectedRank}>
                    <SelectTrigger className="w-[160px] bg-slate-800 border-slate-700 hover:border-cyan-500 focus:border-cyan-500 transition-colors">
                      <Swords className="h-4 w-4 mr-2 text-cyan-400" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-cyan-500/30 backdrop-blur-sm">
                      {RANK_ORDER.map((rank) => (
                        <SelectItem key={rank} value={rank} className="hover:bg-cyan-500/20">
                          <div className="flex items-center gap-2">
                            {RANK_ICONS[rank]}
                            <span className={RANK_COLORS[rank]?.text}>{rank}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {leaderboardType === 'rank' && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg">
                    <span className="text-sm text-slate-400">
                      {entries.length} {selectedRank} Hunters
                    </span>
                  </div>
                )}
              </div>

              {/* Leaderboard Content */}
              <AnimatePresence mode="wait">
                <TabsContent value={leaderboardType} className="mt-0">
                  {loading ? (
                    <div className="space-y-4 p-4">
                      {[...Array(10)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : entries.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-16"
                    >
                      <Trophy className="h-20 w-20 mx-auto mb-4 text-cyan-500/30" />
                      <h3 className="text-xl font-cinzel font-bold text-slate-300 mb-2">
                        No hunters have awakened yet...
                      </h3>
                      <p className="text-sm text-slate-500 mb-6">
                        Be the first to climb the ranks!
                      </p>
                      {!user && (
                        <button
                          onClick={() => navigate('/auth')}
                          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-bold hover:opacity-90 transition-all shadow-lg shadow-cyan-500/30"
                        >
                          Start Your Journey
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    <div className="space-y-8">
                      {/* Top 3 Podium */}
                      {top3Entries.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                          {/* Order: #2, #1, #3 on desktop */}
                          {top3Entries[1] && (
                            <div className="order-2 md:order-1">
                              <PodiumCard 
                                entry={top3Entries[1]} 
                                position={2}
                                onClick={() => handleHunterClick(top3Entries[1])}
                              />
                            </div>
                          )}
                          {top3Entries[0] && (
                            <div className="order-1 md:order-2">
                              <PodiumCard 
                                entry={top3Entries[0]} 
                                position={1}
                                onClick={() => handleHunterClick(top3Entries[0])}
                              />
                            </div>
                          )}
                          {top3Entries[2] && (
                            <div className="order-3">
                              <PodiumCard 
                                entry={top3Entries[2]} 
                                position={3}
                                onClick={() => handleHunterClick(top3Entries[2])}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Remaining Hunters */}
                      {remainingEntries.length > 0 && (
                        <Card className="border-slate-800 bg-slate-900/30 backdrop-blur-sm">
                          <CardHeader className="pb-3 border-b border-slate-800">
                            <CardTitle className="text-lg md:text-xl flex items-center gap-2 font-cinzel">
                              <Swords className="h-5 w-5 text-cyan-400" />
                              {leaderboardType === 'weekly' ? 'Weekly Rankings' : 'All-Time Rankings'}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-2 md:p-4 space-y-2">
                            {remainingEntries.map((entry, index) => (
                              <HunterRow 
                                key={entry.userId}
                                entry={entry}
                                index={index}
                                onClick={() => handleHunterClick(entry)}
                                isWeekly={leaderboardType === 'weekly'}
                              />
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </TabsContent>
              </AnimatePresence>
            </Tabs>
          </motion.div>

          {/* CTA for non-logged users */}
          {!user && entries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-2 border-cyan-500/50 bg-gradient-to-r from-cyan-950/30 via-purple-950/20 to-cyan-950/30 shadow-xl">
                <CardContent className="py-8 text-center space-y-6">
                  <div className="relative inline-block">
                    <Trophy className="h-16 w-16 mx-auto text-cyan-400 animate-pulse" />
                    <Sparkles className="absolute top-0 right-0 h-6 w-6 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2 font-cinzel">Join the Rankings!</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Create an account to track your progress, compete with hunters worldwide, and rise through the ranks.
                    </p>
                    <button
                      onClick={() => navigate('/auth')}
                      className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-bold hover:opacity-90 transition-all duration-200 shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 active:scale-95"
                    >
                      ⚔️ Begin Your Awakening
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>

      {/* Hunter Profile Modal */}
      {selectedHunter && (
        <HunterProfileModal
          open={profileModalOpen}
          onOpenChange={setProfileModalOpen}
          userId={selectedHunter.userId}
          hunterName={selectedHunter.hunterName}
        />
      )}
    </>
  );
};

export default Leaderboard;
