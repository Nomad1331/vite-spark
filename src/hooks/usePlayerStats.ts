import { useState, useEffect, useCallback } from "react";
import { PlayerStats, calculateTotalXPForLevel, calculateXPForNextLevel } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { emitRankUp } from "@/components/RankUpAnimation";

// Event emitter for level up animations
type LevelUpListener = (level: number, pointsEarned: number) => void;
const levelUpListeners: LevelUpListener[] = [];

export const onLevelUp = (listener: LevelUpListener) => {
  levelUpListeners.push(listener);
  return () => {
    const index = levelUpListeners.indexOf(listener);
    if (index > -1) levelUpListeners.splice(index, 1);
  };
};

const emitLevelUp = (level: number, pointsEarned: number) => {
  levelUpListeners.forEach(listener => listener(level, pointsEarned));
};

const DEFAULT_STATS: PlayerStats = {
  level: 1,
  xp: 0,
  totalXP: 0,
  rank: "E-Rank",
  strength: 10,
  agility: 10,
  intelligence: 10,
  vitality: 10,
  sense: 10,
  availablePoints: 0,
  gold: 0,
  gems: 0,
  credits: 0,
  name: "Hunter",
  title: "Awakened Hunter",
  avatar: "",
  selectedCardFrame: "default",
  unlockedCardFrames: ["default"],
  unlockedClasses: [],
  isFirstTime: true,
};
  isFirstTime: true,
};

export const usePlayerStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlayerStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Fetch stats from cloud
  const fetchStats = useCallback(async () => {
    if (!user) {
      setStats(DEFAULT_STATS);
      setLoading(false);
      return;
    }

    try {
      // Fetch profile and player_stats together
      const [profileResult, statsResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('player_stats').select('*').eq('user_id', user.id).maybeSingle(),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (statsResult.error) throw statsResult.error;

      const profile = profileResult.data;
      const cloudStats = statsResult.data;

      if (cloudStats && profile) {
        setStats({
          level: cloudStats.level,
          xp: cloudStats.total_xp - calculateTotalXPForLevel(cloudStats.level),
          totalXP: cloudStats.total_xp,
          rank: cloudStats.rank,
          strength: cloudStats.strength,
          agility: cloudStats.agility,
          intelligence: cloudStats.intelligence,
          vitality: cloudStats.vitality,
          sense: cloudStats.sense,
          availablePoints: cloudStats.available_points,
          gold: cloudStats.gold,
          gems: cloudStats.gems,
          credits: cloudStats.credits,
          name: profile.hunter_name || "Hunter",
          title: profile.title || "Awakened Hunter",
          avatar: profile.avatar || "",
          selectedCardFrame: cloudStats.selected_card_frame || "default",
          unlockedCardFrames: cloudStats.unlocked_card_frames || ["default"],
          unlockedClasses: cloudStats.unlocked_classes || [],
          isFirstTime: false,
        });
      } else {
        // Create initial records
        setStats(DEFAULT_STATS);
      }
      setInitialized(true);
    } catch (error) {
      console.error('Error fetching player stats:', error);
      setStats(DEFAULT_STATS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Save stats to cloud
  const saveStats = useCallback(async (newStats: PlayerStats) => {
    if (!user) return false;

    try {
      // Update player_stats
      const { error: statsError } = await supabase
        .from('player_stats')
        .update({
          level: newStats.level,
          total_xp: newStats.totalXP,
          rank: newStats.rank,
          strength: newStats.strength,
          agility: newStats.agility,
          intelligence: newStats.intelligence,
          vitality: newStats.vitality,
          sense: newStats.sense,
          available_points: newStats.availablePoints,
          gold: newStats.gold,
          gems: newStats.gems,
          credits: newStats.credits,
          selected_card_frame: newStats.selectedCardFrame,
          unlocked_card_frames: newStats.unlockedCardFrames,
          unlocked_classes: newStats.unlockedClasses,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (statsError) throw statsError;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          hunter_name: newStats.name,
          title: newStats.title,
          avatar: newStats.avatar,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      return true;
    } catch (error) {
      console.error('Error saving player stats:', error);
      return false;
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Get active XP boost multiplier
  const getActiveBoostMultiplier = useCallback((): number => {
    // TODO: Implement cloud-based XP boosts
    return 1;
  }, []);

  const getRank = (level: number): string => {
    if (level >= 100) return "S-Rank";
    if (level >= 75) return "A-Rank";
    if (level >= 50) return "B-Rank";
    if (level >= 25) return "C-Rank";
    if (level >= 6) return "D-Rank";
    return "E-Rank";
  };

  const addXP = useCallback(async (amount: number, source?: { type: "quest" | "habit" | "gate" | "streak" | "other"; description: string }) => {
    const boostMultiplier = amount > 0 ? getActiveBoostMultiplier() : 1;
    const boostedAmount = Math.round(amount * boostMultiplier);
    
    setStats((prev) => {
      const oldLevel = prev.level;
      let newTotalXP = prev.totalXP + boostedAmount;
      let newLevel = prev.level;
      let newPoints = prev.availablePoints;
      let levelsGained = 0;

      // Prevent negative XP
      if (newTotalXP < 0) {
        newTotalXP = 0;
      }

      // Calculate new level based on total XP
      while (newTotalXP >= calculateTotalXPForLevel(newLevel + 1)) {
        newLevel += 1;
        newPoints += 5;
        levelsGained += 1;
      }

      // Show level up animation and toasts
      if (levelsGained > 0) {
        emitLevelUp(newLevel, levelsGained * 5);
        toast({
          title: "🎉 LEVEL UP!",
          description: `You are now Level ${newLevel}! +${levelsGained * 5} Ability Points`,
          duration: 5000,
        });
      }

      const newRank = getRank(newLevel);
      const oldRank = prev.rank;
      
      // Emit rank-up animation if rank changed
      if (newRank !== oldRank && levelsGained > 0) {
        setTimeout(() => emitRankUp(oldRank, newRank), 500);
      }

      const newStats = {
        ...prev,
        xp: newTotalXP - calculateTotalXPForLevel(newLevel),
        totalXP: newTotalXP,
        level: newLevel,
        availablePoints: newPoints,
        rank: newRank,
      };

      // Save to cloud in background
      saveStats(newStats);

      return newStats;
    });
  }, [getActiveBoostMultiplier, saveStats]);

  const addGold = useCallback(async (amount: number) => {
    setStats((prev) => {
      const newStats = { ...prev, gold: Math.max(0, prev.gold + amount) };
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  const addGems = useCallback(async (amount: number) => {
    setStats((prev) => {
      const newStats = { ...prev, gems: Math.max(0, (prev.gems || 0) + amount) };
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  const spendGems = useCallback((amount: number): boolean => {
    if ((stats.gems || 0) >= amount) {
      setStats((prev) => {
        const newStats = { ...prev, gems: (prev.gems || 0) - amount };
        saveStats(newStats);
        return newStats;
      });
      return true;
    }
    return false;
  }, [stats.gems, saveStats]);

  const addCredits = useCallback(async (amount: number) => {
    setStats((prev) => {
      const newStats = { ...prev, credits: Math.max(0, prev.credits + amount) };
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  const spendCredits = useCallback((amount: number): boolean => {
    if (stats.credits >= amount) {
      setStats((prev) => {
        const newStats = { ...prev, credits: prev.credits - amount };
        saveStats(newStats);
        return newStats;
      });
      return true;
    }
    return false;
  }, [stats.credits, saveStats]);

  const unlockCardFrame = useCallback((frameId: string, cost: number): { success: boolean; newStats: PlayerStats | null } => {
    if (stats.credits >= cost && !stats.unlockedCardFrames?.includes(frameId)) {
      const newStats: PlayerStats = {
        ...stats,
        credits: stats.credits - cost,
        unlockedCardFrames: [...(stats.unlockedCardFrames || ["default"]), frameId],
      };
      setStats(newStats);
      saveStats(newStats);
      return { success: true, newStats };
    }
    return { success: false, newStats: null };
  }, [stats, saveStats]);

  const unlockClass = useCallback((classId: string) => {
    if (!stats.unlockedClasses?.includes(classId)) {
      setStats((prev) => {
        const newStats = {
          ...prev,
          unlockedClasses: [...(prev.unlockedClasses || []), classId],
        };
        saveStats(newStats);
        return newStats;
      });
      return true;
    }
    return false;
  }, [stats.unlockedClasses, saveStats]);

  const allocateStat = useCallback((stat: keyof PlayerStats, amount: number = 1) => {
    setStats((prev) => {
      if (prev.availablePoints < amount) return prev;
      const newStats = {
        ...prev,
        [stat]: (prev[stat] as number) + amount,
        availablePoints: prev.availablePoints - amount,
      };
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  const getTotalPower = useCallback((): number => {
    return stats.strength + stats.agility + stats.intelligence + stats.vitality + stats.sense;
  }, [stats]);

  const getXPForNextLevel = useCallback((): number => {
    return calculateXPForNextLevel(stats.level);
  }, [stats.level]);

  const getCurrentLevelXP = useCallback((): number => {
    return stats.totalXP - calculateTotalXPForLevel(stats.level);
  }, [stats.totalXP, stats.level]);

  const applyGatePenalty = useCallback(() => {
    setStats((prev) => {
      const creditsLoss = Math.round(prev.credits * 0.1);
      const xpLoss = Math.round(prev.totalXP * 0.1);
      let newTotalXP = Math.max(0, prev.totalXP - xpLoss);
      
      let newLevel = prev.level;
      while (newLevel > 1 && newTotalXP < calculateTotalXPForLevel(newLevel)) {
        newLevel -= 1;
      }
      
      newLevel = Math.max(1, newLevel - 1);
      
      const maxAllowedXP = calculateTotalXPForLevel(newLevel + 1) - 1;
      newTotalXP = Math.min(newTotalXP, maxAllowedXP);
      
      const newStats = {
        ...prev,
        credits: Math.max(0, prev.credits - creditsLoss),
        totalXP: newTotalXP,
        xp: newTotalXP - calculateTotalXPForLevel(newLevel),
        level: newLevel,
        strength: Math.max(10, prev.strength - 5),
        agility: Math.max(10, prev.agility - 5),
        intelligence: Math.max(10, prev.intelligence - 5),
        vitality: Math.max(10, prev.vitality - 5),
        sense: Math.max(10, prev.sense - 5),
        rank: getRank(newLevel),
      };
      
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  const applyNecromancerNormalPenalty = useCallback(() => {
    setStats((prev) => {
      const xpLoss = Math.round(prev.totalXP * 0.05);
      const goldLoss = Math.round(prev.gold * 0.05);
      const creditsLoss = Math.round(prev.credits * 0.05);
      const gemsLoss = Math.round((prev.gems || 0) * 0.05);
      
      let newTotalXP = Math.max(0, prev.totalXP - xpLoss);
      let newLevel = prev.level;
      while (newLevel > 1 && newTotalXP < calculateTotalXPForLevel(newLevel)) {
        newLevel -= 1;
      }
      
      const newStats = {
        ...prev,
        totalXP: newTotalXP,
        xp: newTotalXP - calculateTotalXPForLevel(newLevel),
        level: newLevel,
        gold: Math.max(0, prev.gold - goldLoss),
        credits: Math.max(0, prev.credits - creditsLoss),
        gems: Math.max(0, (prev.gems || 0) - gemsLoss),
        strength: Math.max(10, Math.round(prev.strength * 0.95)),
        agility: Math.max(10, Math.round(prev.agility * 0.95)),
        intelligence: Math.max(10, Math.round(prev.intelligence * 0.95)),
        vitality: Math.max(10, Math.round(prev.vitality * 0.95)),
        sense: Math.max(10, Math.round(prev.sense * 0.95)),
        rank: getRank(newLevel),
      };
      
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  const applyNecromancerHardPenalty = useCallback(() => {
    const resetStats: PlayerStats = {
      ...stats,
      level: 1,
      xp: 0,
      totalXP: 0,
      gold: 0,
      credits: 0,
      gems: 0,
      strength: 10,
      agility: 10,
      intelligence: 10,
      vitality: 10,
      sense: 10,
      availablePoints: 0,
      rank: "E-Rank",
      title: "Awakened Hunter",
      unlockedClasses: [],
    };
    
    setStats(resetStats);
    saveStats(resetStats);
  }, [stats, saveStats]);

  const applyHardModeRewards = useCallback(() => {
    setStats((prev) => {
      const newLevel = prev.level + 10;
      const newStats = {
        ...prev,
        level: newLevel,
        totalXP: calculateTotalXPForLevel(newLevel),
        xp: 0,
        strength: prev.strength + 20,
        agility: prev.agility + 20,
        intelligence: prev.intelligence + 20,
        vitality: prev.vitality + 20,
        sense: prev.sense + 20,
        credits: prev.credits + 100,
        gold: prev.gold + 5,
        gems: (prev.gems || 0) + 5,
        rank: getRank(newLevel),
      };
      
      saveStats(newStats);
      return newStats;
    });
  }, [saveStats]);

  const getCurrentStats = useCallback(() => stats, [stats]);

  return {
    stats,
    loading,
    addXP,
    addGold,
    addGems,
    spendGems,
    addCredits,
    spendCredits,
    unlockCardFrame,
    unlockClass,
    allocateStat,
    getTotalPower,
    getXPForNextLevel,
    getCurrentLevelXP,
    applyGatePenalty,
    applyNecromancerNormalPenalty,
    applyNecromancerHardPenalty,
    applyHardModeRewards,
    getActiveBoostMultiplier,
    getCurrentStats,
    fetchStats,
  };
};
