import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { HunterAvatar } from '@/components/HunterAvatar';
import { Crown, Shield, Zap, Brain, Heart, Eye, Flame, Trophy, Star, Swords } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface HunterProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  hunterName: string;
}

interface ProfileData {
  avatar: string | null;
  title: string | null;
  discord_id: string | null;
}

interface StatsData {
  level: number;
  total_xp: number;
  weekly_xp: number;
  rank: string;
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  sense: number;
  selected_card_frame: string | null;
}

// Class emoji mapping - same as PlayerProfileCard
const CLASS_EMOJIS: Record<string, string> = {
  fighter: "⚔️",
  warrior: "⚔️",
  tanker: "🛡️",
  mage: "🔮",
  assassin: "🗡️",
  ranger: "🏹",
  healer: "💚",
  hunter: "🏹",
  necromancer: "💀",
  default: "⚔️",
};

const RANK_STYLES: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  'E-Rank': { bg: 'bg-gray-900/80', border: 'border-gray-500', text: 'text-gray-300', glow: 'shadow-gray-500/30' },
  'D-Rank': { bg: 'bg-green-950/80', border: 'border-green-500', text: 'text-green-400', glow: 'shadow-green-500/30' },
  'C-Rank': { bg: 'bg-blue-950/80', border: 'border-blue-500', text: 'text-blue-400', glow: 'shadow-blue-500/30' },
  'B-Rank': { bg: 'bg-purple-950/80', border: 'border-purple-500', text: 'text-purple-400', glow: 'shadow-purple-500/30' },
  'A-Rank': { bg: 'bg-orange-950/80', border: 'border-orange-500', text: 'text-orange-400', glow: 'shadow-orange-500/30' },
  'S-Rank': { bg: 'bg-red-950/80', border: 'border-red-500', text: 'text-red-400', glow: 'shadow-red-500/30' },
};

const STAT_CONFIG = [
  { key: 'strength', label: 'STR', icon: Flame, color: 'from-red-500 to-orange-500' },
  { key: 'agility', label: 'AGI', icon: Zap, color: 'from-yellow-500 to-green-500' },
  { key: 'intelligence', label: 'INT', icon: Brain, color: 'from-blue-500 to-cyan-500' },
  { key: 'vitality', label: 'VIT', icon: Heart, color: 'from-pink-500 to-red-500' },
  { key: 'sense', label: 'SEN', icon: Eye, color: 'from-purple-500 to-pink-500' },
];

export const HunterProfileModal = ({ open, onOpenChange, userId, hunterName }: HunterProfileModalProps) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    if (open && userId) {
      fetchHunterData();
    }
  }, [open, userId]);

  const fetchHunterData = async () => {
    setLoading(true);
    try {
      const [profileRes, statsRes] = await Promise.all([
        supabase.from('profiles').select('avatar, title, discord_id').eq('user_id', userId).single(),
        supabase.from('player_stats').select('level, total_xp, weekly_xp, rank, strength, agility, intelligence, vitality, sense, selected_card_frame').eq('user_id', userId).single(),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (statsRes.data) setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching hunter data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePower = () => {
    if (!stats) return 0;
    return stats.strength + stats.agility + stats.intelligence + stats.vitality + stats.sense;
  };

  const rankStyle = stats ? RANK_STYLES[stats.rank] || RANK_STYLES['E-Rank'] : RANK_STYLES['E-Rank'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-md border-2 ${rankStyle.border} ${rankStyle.bg} shadow-lg ${rankStyle.glow} max-h-[85vh] overflow-y-auto`}>
        {loading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-20 w-20 rounded-full mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="text-center space-y-4">
              <VisuallyHidden>
                <DialogDescription>Hunter profile for {hunterName}</DialogDescription>
              </VisuallyHidden>
              {/* Avatar with glowing ring */}
              <div className="relative mx-auto pt-2">
                <div className={`absolute inset-0 rounded-full blur-lg ${rankStyle.bg} opacity-60`} />
                <div className={`relative rounded-full border-4 ${rankStyle.border} shadow-xl p-1 bg-background/20`}>
                  <HunterAvatar
                    avatar={profile?.avatar}
                    hunterName={hunterName}
                    size="xl"
                    showBorder={false}
                  />
                </div>
                {/* Rank badge overlay */}
                <div className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full border ${rankStyle.border} ${rankStyle.bg} ${rankStyle.text} text-xs font-bold shadow-lg`}>
                  {stats?.rank}
                </div>
              </div>

              {/* Hunter Name & Title */}
              <div>
                <DialogTitle className={`text-2xl font-bold font-orbitron ${rankStyle.text} tracking-wide`}>
                  {hunterName}
                </DialogTitle>
                <p className="text-muted-foreground text-sm mt-1 font-rajdhani">
                  {profile?.title || 'Awakened Hunter'}
                </p>
              </div>
            </DialogHeader>

            {/* Stats Grid */}
            <div className="space-y-6 mt-6">
              {/* Level & Power Row */}
              <div className="flex justify-between items-center px-4 py-3 rounded-lg bg-background/30 border border-border/50">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <span className="text-foreground font-bold text-lg">Lv. {stats?.level}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Swords className="h-5 w-5 text-secondary" />
                  <span className="text-secondary font-bold text-lg">{calculatePower().toLocaleString()} PWR</span>
                </div>
              </div>

              {/* XP Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="px-3 py-2 rounded-lg bg-background/30 border border-border/50 text-center">
                  <Trophy className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Total XP</p>
                  <p className="text-foreground font-bold">{stats?.total_xp.toLocaleString()}</p>
                </div>
                <div className="px-3 py-2 rounded-lg bg-background/30 border border-border/50 text-center">
                  <Star className="h-4 w-4 text-yellow-400 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Weekly XP</p>
                  <p className="text-foreground font-bold">{stats?.weekly_xp?.toLocaleString() || 0}</p>
                </div>
              </div>

              {/* Stat Bars */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Attributes
                </h4>
                {STAT_CONFIG.map(({ key, label, icon: Icon, color }) => {
                  const value = stats?.[key as keyof StatsData] as number || 10;
                  const maxStat = 200;
                  const percentage = (value / maxStat) * 100;
                  
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-16">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground">{label}</span>
                      </div>
                      <div className="flex-1 relative">
                        <div className="h-3 bg-background/50 rounded-full overflow-hidden border border-border/30">
                          <div 
                            className={`h-full bg-gradient-to-r ${color} transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-bold text-foreground w-10 text-right">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
