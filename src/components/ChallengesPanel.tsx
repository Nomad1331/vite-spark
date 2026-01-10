import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useCloudChallenges } from "@/hooks/useCloudChallenges";
import { useCloudStreaks } from "@/hooks/useCloudStreaks";
import { useCloudQuests } from "@/hooks/useCloudQuests";
import { useCloudHabits } from "@/hooks/useCloudHabits";
import { useCloudGates } from "@/hooks/useCloudGates";
import { useAuth } from "@/contexts/AuthContext";
import { Challenge, generateDailyChallenge, generateWeeklyChallenge, NECROMANCER_CHALLENGE, LegendaryChallenge, NecromancerMode } from "@/lib/challenges";
import { Trophy, Calendar, Target, Sparkles, Skull, Crown, Shield, Loader2 } from "lucide-react";
import { playSuccess, playLevelUp, playClick } from "@/lib/sounds";
import { NecromancerModeModal } from "./NecromancerModeModal";

export const ChallengesPanel = () => {
  const { user } = useAuth();
  const { addXP, addGold, addCredits, stats, unlockClass, applyHardModeRewards, applyNecromancerNormalPenalty, applyNecromancerHardPenalty } = usePlayerStats();
  const { challenges, necroChallenge, claimedChallenges, loading, updateChallenges, updateNecroChallenge, claimChallenge } = useCloudChallenges();
  const { streak } = useCloudStreaks();
  const { quests } = useCloudQuests();
  const { habits } = useCloudHabits();
  const { gates } = useCloudGates();
  
  const [localChallenges, setLocalChallenges] = useState<Challenge[]>([]);
  const [localNecroChallenge, setLocalNecroChallenge] = useState<LegendaryChallenge>(NECROMANCER_CHALLENGE);
  const [showModeModal, setShowModeModal] = useState(false);

  // Check if necromancer is already unlocked
  const isNecromancerUnlocked = stats.unlockedClasses?.includes("necromancer") || false;

  // Initialize local state from cloud
  useEffect(() => {
    if (challenges && challenges.length > 0) {
      setLocalChallenges(challenges);
    } else if (!loading) {
      // Generate initial challenges if none exist
      const initial = [generateDailyChallenge(), generateWeeklyChallenge()];
      setLocalChallenges(initial);
      updateChallenges(initial);
    }
  }, [challenges, loading]);

  useEffect(() => {
    if (necroChallenge) {
      setLocalNecroChallenge(necroChallenge);
    }
  }, [necroChallenge]);

  // Helper to get week key for tracking weekly claims
  const getWeekKey = (date: Date) => {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber}`;
  };

  // Check and update challenge progress
  useEffect(() => {
    if (localChallenges.length === 0) return;
    
    const today = new Date().toISOString().split("T")[0];
    let hasChanges = false;

    const updated = localChallenges.map((challenge) => {
      if (challenge.status !== "active") return challenge;

      let current = 0;
      switch (challenge.requirement.type) {
        case "quest_count":
          if (challenge.type === "daily") {
            if (challenge.requirement.target === -1) {
              const totalQuests = quests.length;
              const completedQuests = quests.filter((q) => q.completed).length;
              current = totalQuests > 0 && completedQuests === totalQuests ? totalQuests : completedQuests;
              challenge.requirement.target = totalQuests > 0 ? totalQuests : 1;
            } else {
              current = quests.filter((q) => q.completed).length;
            }
          } else {
            current = quests.filter((q) => q.completed).length;
          }
          break;
        case "streak":
          current = streak.currentStreak;
          break;
        case "habit_completion":
          current = habits.filter((h) => h.completionGrid[today]).length;
          break;
        case "gate_clear":
          current = gates.filter((g) => g.status === "completed").length;
          break;
        case "total_xp":
          current = stats.totalXP;
          break;
      }

      if (current !== challenge.requirement.current) {
        hasChanges = true;
      }

      const updatedChallenge = { ...challenge, requirement: { ...challenge.requirement, current } };

      // Auto-complete if target reached
      if (current >= challenge.requirement.target && challenge.status === "active") {
        return { ...updatedChallenge, status: "completed" as const, completedDate: new Date().toISOString() };
      }

      return updatedChallenge;
    });

    if (hasChanges) {
      setLocalChallenges(updated);
      updateChallenges(updated);
    }
  }, [quests, habits, gates, streak, stats.totalXP, localChallenges.length]);

  // Check for expired challenges and generate new ones
  useEffect(() => {
    if (loading) return;
    
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentWeek = getWeekKey(now);
    
    let updated = localChallenges.map((challenge) => {
      if (challenge.status === "active" && new Date(challenge.endDate) < now) {
        return { ...challenge, status: "expired" as const };
      }
      return challenge;
    });

    // Generate new challenges if needed
    const hasActiveOrCompletedDaily = updated.some((c) => c.type === "daily" && (c.status === "active" || c.status === "completed"));
    const hasActiveOrCompletedWeekly = updated.some((c) => c.type === "weekly" && (c.status === "active" || c.status === "completed"));
    
    const dailyClaimedToday = claimedChallenges[`daily_${today}`];
    const weeklyClaimedThisWeek = claimedChallenges[`weekly_${currentWeek}`];

    if (!hasActiveOrCompletedDaily && !dailyClaimedToday) {
      updated = [...updated, generateDailyChallenge()];
    }
    if (!hasActiveOrCompletedWeekly && !weeklyClaimedThisWeek) {
      updated = [...updated, generateWeeklyChallenge()];
    }
    
    if (updated.length !== localChallenges.length) {
      setLocalChallenges(updated);
      updateChallenges(updated);
    }
  }, [loading, claimedChallenges]);

  // Update Necromancer challenge progress
  useEffect(() => {
    if (isNecromancerUnlocked || localNecroChallenge.status === "pending") return;
    
    const currentStreak = streak.currentStreak;
    const lastCompletionDate = streak.lastCompletionDate;
    
    // Get today's date and yesterday's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Parse last completion date
    let lastCompletion: Date | null = null;
    if (lastCompletionDate) {
      lastCompletion = new Date(lastCompletionDate);
      lastCompletion.setHours(0, 0, 0, 0);
    }
    
    // Detect streak failure
    const hadProgress = localNecroChallenge.requirement.current > 0 && localNecroChallenge.status === "active";
    const streakDropped = currentStreak < localNecroChallenge.requirement.current;
    
    let missedDay = false;
    if (hadProgress && lastCompletion) {
      const daysSinceLastCompletion = Math.floor((today.getTime() - lastCompletion.getTime()) / (1000 * 60 * 60 * 24));
      missedDay = daysSinceLastCompletion > 1;
    }
    
    const streakBroken = hadProgress && (streakDropped || missedDay);
    
    if (streakBroken) {
      if (localNecroChallenge.mode === "hard") {
        applyNecromancerHardPenalty();
        toast({
          title: "💀 CONTRACT BROKEN - TOTAL RESET",
          description: "You broke your streak. All progress has been wiped. The Necromancer challenge has been reset.",
          variant: "destructive",
          duration: 10000,
        });
      } else {
        applyNecromancerNormalPenalty();
        toast({
          title: "⚠️ STREAK BROKEN - 5% PENALTY",
          description: "You broke your streak. Lost 5% of all major stats. Challenge progress reset to 0.",
          variant: "destructive",
          duration: 8000,
        });
      }
      
      const resetNecro = {
        ...NECROMANCER_CHALLENGE,
        status: "pending" as const,
        mode: null,
        requirement: { ...localNecroChallenge.requirement, current: 0 },
      };
      setLocalNecroChallenge(resetNecro);
      updateNecroChallenge(resetNecro);
      return;
    }
    
    const isCompleted = currentStreak >= localNecroChallenge.requirement.target;
    if (currentStreak !== localNecroChallenge.requirement.current || (isCompleted && localNecroChallenge.status !== "completed")) {
      const updated = {
        ...localNecroChallenge,
        requirement: { ...localNecroChallenge.requirement, current: currentStreak },
        status: isCompleted ? "completed" as const : "active" as const,
      };
      setLocalNecroChallenge(updated);
      updateNecroChallenge(updated);
    }
  }, [streak, isNecromancerUnlocked, localNecroChallenge.status]);

  const handleAcceptChallenge = () => {
    playClick();
    setShowModeModal(true);
  };

  const handleSelectMode = (mode: NecromancerMode) => {
    const updated = {
      ...localNecroChallenge,
      status: "active" as const,
      mode,
      acceptedDate: new Date().toISOString(),
      requirement: { ...localNecroChallenge.requirement, current: 0 },
    };
    setLocalNecroChallenge(updated);
    updateNecroChallenge(updated);
    
    toast({
      title: mode === "hard" ? "💀 HIGH-RISK CONTRACT ACCEPTED" : "🛡️ CHALLENGE ACCEPTED",
      description: mode === "hard" 
        ? "You have entered the Path of the Necromancer in Hard Mode. One mistake ends everything."
        : "You have entered the Path of the Necromancer. Complete 90 days to unlock the class.",
      duration: 5000,
    });
  };

  const claimNecromancerReward = () => {
    if (localNecroChallenge.status !== "completed" || isNecromancerUnlocked) return;
    
    unlockClass("necromancer");
    
    if (localNecroChallenge.mode === "hard") {
      applyHardModeRewards();
      toast({
        title: "💀 NECROMANCER UNLOCKED + HARD MODE REWARDS!",
        description: "+10 Levels, +20 to all stats, +100 Credits, +5 Gold, +5 Gems!",
        duration: 8000,
      });
    } else {
      toast({
        title: "💀 NECROMANCER UNLOCKED!",
        description: "You have awakened the forbidden power of the Necromancer class!",
        duration: 6000,
      });
    }
    
    const updated = {
      ...localNecroChallenge,
      completedDate: new Date().toISOString(),
    };
    setLocalNecroChallenge(updated);
    updateNecroChallenge(updated);
    
    playLevelUp();
  };

  const claimReward = (challengeId: string) => {
    const challenge = localChallenges.find((c) => c.id === challengeId);
    if (!challenge || challenge.status !== "completed") return;

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentWeek = getWeekKey(now);
    const claimKey = challenge.type === "daily" ? `daily_${today}` : `weekly_${currentWeek}`;
    
    if (claimedChallenges[claimKey]) {
      toast({
        title: "Already Claimed",
        description: `You already claimed a ${challenge.type} challenge reward for this period.`,
        variant: "destructive",
      });
      return;
    }

    addXP(challenge.rewards.xp, {
      type: "other",
      description: `Challenge: ${challenge.name}`,
    });

    if (challenge.rewards.gold) addGold(challenge.rewards.gold);
    if (challenge.rewards.credits) addCredits(challenge.rewards.credits);
    if (challenge.rewards.gems) {
      toast({
        title: "💎 Gems Earned!",
        description: `+${challenge.rewards.gems} Gems`,
      });
    }

    playSuccess();

    claimChallenge(claimKey);
    
    // Remove completed challenge
    const updated = localChallenges.filter((c) => c.id !== challengeId);
    setLocalChallenges(updated);
    updateChallenges(updated);

    toast({
      title: "🏆 Challenge Completed!",
      description: `${challenge.name} rewards claimed!`,
      duration: 4000,
    });
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Please sign in to view challenges.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading challenges...</span>
      </div>
    );
  }

  const activeChallenges = localChallenges.filter((c) => c.status === "active" || c.status === "completed");
  const necroProgressPercent = Math.min(100, (localNecroChallenge.requirement.current / localNecroChallenge.requirement.target) * 100);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-primary font-cinzel mb-2" style={{ textShadow: "0 0 10px hsl(var(--neon-cyan) / 0.8)" }}>
          CHALLENGES
        </h2>
        <p className="text-muted-foreground">Complete special challenges for massive rewards</p>
      </div>

      {activeChallenges.length === 0 && (
        <Card className="p-8 text-center bg-muted/30">
          <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No active challenges. Check back tomorrow!</p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {activeChallenges.map((challenge) => {
          const progressPercent = Math.min(100, (challenge.requirement.current / challenge.requirement.target) * 100);
          const isCompleted = challenge.status === "completed";

          return (
            <Card
              key={challenge.id}
              className={`p-6 transition-all duration-300 ${
                isCompleted
                  ? "bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/50 shadow-[0_0_20px_hsl(var(--neon-cyan)/0.3)]"
                  : "bg-card border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-start gap-3 mb-4">
                {challenge.type === "daily" ? (
                  <Calendar className="w-8 h-8 text-primary" />
                ) : (
                  <Target className="w-8 h-8 text-secondary" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-foreground font-cinzel">{challenge.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        challenge.type === "daily"
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary/20 text-secondary"
                      }`}
                    >
                      {challenge.type.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{challenge.description}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <span className="text-sm font-bold text-primary">
                    {challenge.requirement.current} / {challenge.requirement.target}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {/* Rewards */}
              <div className="p-3 bg-background/50 border border-border rounded-lg mb-4">
                <p className="text-xs text-muted-foreground mb-2">Rewards</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  {challenge.rewards.xp && <span className="text-primary">+{challenge.rewards.xp} XP</span>}
                  {challenge.rewards.gold && <span className="text-yellow-400">+{challenge.rewards.gold} Gold</span>}
                  {challenge.rewards.gems && <span className="text-neon-purple">+{challenge.rewards.gems} Gems</span>}
                  {challenge.rewards.credits && <span className="text-neon-cyan">+{challenge.rewards.credits} Credits</span>}
                </div>
              </div>

              {/* Action */}
              {isCompleted ? (
                <Button
                  onClick={() => claimReward(challenge.id)}
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Claim Reward
                </Button>
              ) : (
                <div className="text-center py-2 text-sm text-muted-foreground">
                  {Math.round(progressPercent)}% Complete
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Legendary Challenge - Necromancer */}
      {!isNecromancerUnlocked && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-6 h-6 text-purple-400" />
            <h3 className="text-xl font-bold text-purple-400 font-cinzel">LEGENDARY CHALLENGE</h3>
          </div>
          
          <Card className={`p-6 transition-all duration-300 border-2 ${
            localNecroChallenge.status === "completed"
              ? "bg-gradient-to-br from-purple-900/30 to-red-900/30 border-purple-500 shadow-[0_0_30px_hsl(280_80%_40%/0.4)]"
              : localNecroChallenge.status === "pending"
              ? "bg-gradient-to-br from-purple-900/5 to-background border-purple-500/20 hover:border-purple-500/40"
              : "bg-gradient-to-br from-purple-900/10 to-background border-purple-500/30 hover:border-purple-500/50"
          }`}>
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
                <Skull className="w-10 h-10 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-2xl font-bold text-purple-400 font-cinzel">{localNecroChallenge.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    LEGENDARY
                  </span>
                  {localNecroChallenge.status === "active" && localNecroChallenge.mode && (
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      localNecroChallenge.mode === "hard" 
                        ? "bg-red-500/20 text-red-400 border-red-500/30" 
                        : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    }`}>
                      {localNecroChallenge.mode === "hard" ? "HARD MODE" : "NORMAL MODE"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{localNecroChallenge.description}</p>
              </div>
            </div>

            {/* Progress - Only show if active or completed */}
            {localNecroChallenge.status !== "pending" && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Streak Progress</span>
                  <span className="text-sm font-bold text-purple-400">
                    {localNecroChallenge.requirement.current} / {localNecroChallenge.requirement.target} days
                  </span>
                </div>
                <div className="relative h-3 bg-purple-950/50 rounded-full overflow-hidden border border-purple-500/30">
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                    style={{ width: `${necroProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Reward - Different based on mode */}
            <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-lg mb-4">
              <p className="text-xs text-muted-foreground mb-2">
                {localNecroChallenge.status === "pending" ? "Potential Rewards" : "Reward"}
              </p>
              {localNecroChallenge.status === "pending" ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-400">Normal: </span>
                    <span className="text-muted-foreground">Unlock Necromancer Class</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skull className="w-4 h-4 text-red-400" />
                    <span className="text-red-400">Hard: </span>
                    <span className="text-muted-foreground">Class + 10 Levels + Stats + Currency</span>
                  </div>
                </div>
              ) : localNecroChallenge.mode === "hard" ? (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">💀</span>
                    <span className="text-purple-400 font-bold">Unlock Necromancer Class</span>
                  </div>
                  <p className="text-muted-foreground pl-8">+ 10 Levels, +20 all stats, +100 Credits, +5 Gold, +5 Gems</p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💀</span>
                  <span className="text-purple-400 font-bold">Unlock Necromancer Class</span>
                </div>
              )}
            </div>

            {/* Action */}
            {localNecroChallenge.status === "pending" ? (
              <Button
                onClick={handleAcceptChallenge}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300 text-white"
              >
                <Skull className="w-4 h-4 mr-2" />
                Accept Challenge
              </Button>
            ) : localNecroChallenge.status === "completed" ? (
              <Button
                onClick={claimNecromancerReward}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300 text-white"
              >
                <Skull className="w-4 h-4 mr-2" />
                Claim Necromancer Class
              </Button>
            ) : (
              <div className="text-center py-2 text-sm text-muted-foreground">
                {Math.round(necroProgressPercent)}% Complete • {90 - localNecroChallenge.requirement.current} days remaining
              </div>
            )}
          </Card>
        </div>
      )}

      {isNecromancerUnlocked && (
        <Card className="mt-8 p-6 bg-gradient-to-br from-purple-900/20 to-background border-purple-500/30">
          <div className="flex items-center gap-3">
            <span className="text-4xl">💀</span>
            <div>
              <h3 className="text-xl font-bold text-purple-400 font-cinzel">NECROMANCER UNLOCKED</h3>
              <p className="text-sm text-muted-foreground">You have mastered the forbidden arts. Equip this class in Customize.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Mode Selection Modal */}
      <NecromancerModeModal
        open={showModeModal}
        onClose={() => setShowModeModal(false)}
        onSelectMode={handleSelectMode}
      />
    </div>
  );
};
