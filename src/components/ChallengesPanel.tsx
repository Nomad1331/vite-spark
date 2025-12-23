import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { Challenge, generateDailyChallenge, generateWeeklyChallenge, NECROMANCER_CHALLENGE, LegendaryChallenge, NecromancerMode, NECROMANCER_REWARDS } from "@/lib/challenges";
import { storage } from "@/lib/storage";
import { Trophy, Calendar, Target, Sparkles, Skull, Crown, Shield } from "lucide-react";
import { playSuccess, playLevelUp, playClick } from "@/lib/sounds";
import { NecromancerModeModal } from "./NecromancerModeModal";

export const ChallengesPanel = () => {
  const { addXP, addGold, addCredits, stats, unlockClass, applyHardModeRewards, applyNecromancerNormalPenalty, applyNecromancerHardPenalty } = usePlayerStats();
  const [hasMounted, setHasMounted] = useState(false);
  
  // Track claimed challenges to prevent re-claiming on reload
  const [claimedChallenges, setClaimedChallenges] = useState<Record<string, string>>(() => {
    const stored = localStorage.getItem("soloLevelingClaimedChallenges");
    return stored ? JSON.parse(stored) : {};
  });

  const [challenges, setChallenges] = useState<Challenge[]>(() => {
    const stored = localStorage.getItem("soloLevelingChallenges");
    if (stored) {
      return JSON.parse(stored);
    }
    // Generate initial challenges
    return [generateDailyChallenge(), generateWeeklyChallenge()];
  });

  // Necromancer legendary challenge state
  const [necroChallenge, setNecroChallenge] = useState<LegendaryChallenge>(() => {
    const stored = localStorage.getItem("soloLevelingNecroChallenge");
    if (stored) {
      return JSON.parse(stored);
    }
    return NECROMANCER_CHALLENGE;
  });

  // Mode selection modal state
  const [showModeModal, setShowModeModal] = useState(false);

  // Check if necromancer is already unlocked
  const isNecromancerUnlocked = stats.unlockedClasses?.includes("necromancer") || false;

  // Mark as mounted after first render to prevent overwriting imported data
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Save claimed challenges to localStorage - only after mount
  useEffect(() => {
    if (hasMounted) {
      localStorage.setItem("soloLevelingClaimedChallenges", JSON.stringify(claimedChallenges));
    }
  }, [claimedChallenges, hasMounted]);

  useEffect(() => {
    if (hasMounted) {
      localStorage.setItem("soloLevelingChallenges", JSON.stringify(challenges));
    }
  }, [challenges, hasMounted]);

  // Check and update challenge progress
  useEffect(() => {
    const updateProgress = () => {
      const quests = storage.getQuests();
      const habits = storage.getHabits();
      const streakData = storage.getStreak();
      const gates = storage.getGates();
      const today = new Date().toISOString().split("T")[0];

      setChallenges((prev) =>
        prev.map((challenge) => {
          if (challenge.status !== "active") return challenge;

          let current = 0;
          switch (challenge.requirement.type) {
            case "quest_count":
              if (challenge.type === "daily") {
                // For "Perfect Day" challenge with target -1, check if all quests are completed
                if (challenge.requirement.target === -1) {
                  const totalQuests = quests.length;
                  const completedQuests = quests.filter((q) => q.completed).length;
                  current = totalQuests > 0 && completedQuests === totalQuests ? totalQuests : completedQuests;
                  // Override target to match total
                  challenge.requirement.target = totalQuests > 0 ? totalQuests : 1;
                } else {
                  current = quests.filter((q) => q.completed).length;
                }
              } else {
                // Weekly: count quests from start date
                current = quests.filter((q) => q.completed).length; // Simplified for demo
              }
              break;
            case "streak":
              current = streakData.currentStreak;
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

          const updated = { ...challenge, requirement: { ...challenge.requirement, current } };

          // Auto-complete if target reached
          if (current >= challenge.requirement.target && challenge.status === "active") {
            return { ...updated, status: "completed" as const, completedDate: new Date().toISOString() };
          }

          return updated;
        })
      );
    };

    updateProgress();
  }, [stats, challenges.length]);

  // Helper to get week key for tracking weekly claims
  const getWeekKey = (date: Date) => {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber}`;
  };

  // Check for expired challenges and generate new ones (run once on mount)
  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentWeek = getWeekKey(now);
    
    setChallenges((prev) => {
      let updated = prev.map((challenge) => {
        if (challenge.status === "active" && new Date(challenge.endDate) < now) {
          return { ...challenge, status: "expired" as const };
        }
        return challenge;
      });

      // Generate new challenges if needed, but only if not already claimed for this period
      const hasActiveOrCompletedDaily = updated.some((c) => c.type === "daily" && (c.status === "active" || c.status === "completed"));
      const hasActiveOrCompletedWeekly = updated.some((c) => c.type === "weekly" && (c.status === "active" || c.status === "completed"));
      
      // Check if we already claimed a challenge for this period
      const dailyClaimedToday = claimedChallenges[`daily_${today}`];
      const weeklyClaimedThisWeek = claimedChallenges[`weekly_${currentWeek}`];

      if (!hasActiveOrCompletedDaily && !dailyClaimedToday) {
        updated = [...updated, generateDailyChallenge()];
      }
      if (!hasActiveOrCompletedWeekly && !weeklyClaimedThisWeek) {
        updated = [...updated, generateWeeklyChallenge()];
      }
      
      return updated;
    });
  }, [claimedChallenges]); // Re-run when claimed challenges change

  // Update Necromancer challenge progress and detect streak failures
  useEffect(() => {
    if (isNecromancerUnlocked || necroChallenge.status === "pending") return;
    
    const streakData = storage.getStreak();
    const currentStreak = streakData.currentStreak;
    const lastCompletionDate = streakData.lastCompletionDate;
    
    setNecroChallenge((prev) => {
      if (prev.status === "pending") return prev;
      
      // Get today's date and yesterday's date in the user's timezone
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
      
      // Detect streak failure: 
      // 1. User had progress (was active) AND
      // 2. Either current streak dropped OR user missed completing yesterday (and today not yet completed)
      const hadProgress = prev.requirement.current > 0 && prev.status === "active";
      const streakDropped = currentStreak < prev.requirement.current;
      
      // Check if user missed a day - if last completion is older than yesterday
      let missedDay = false;
      if (hadProgress && lastCompletion) {
        const daysSinceLastCompletion = Math.floor((today.getTime() - lastCompletion.getTime()) / (1000 * 60 * 60 * 24));
        // If more than 1 day has passed since last completion, streak is broken
        missedDay = daysSinceLastCompletion > 1;
      }
      
      const streakBroken = hadProgress && (streakDropped || missedDay);
      
      if (streakBroken) {
        // Apply penalties based on mode
        if (prev.mode === "hard") {
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
        
        // Reset challenge to pending so user can reattempt
        return {
          ...NECROMANCER_CHALLENGE,
          status: "pending" as const,
          mode: null,
          requirement: { ...prev.requirement, current: 0 },
        };
      }
      
      const updated = {
        ...prev,
        requirement: { ...prev.requirement, current: currentStreak },
        status: currentStreak >= prev.requirement.target ? "completed" as const : "active" as const,
      };
      return updated;
    });
  }, [stats, isNecromancerUnlocked, necroChallenge.status, applyNecromancerNormalPenalty, applyNecromancerHardPenalty]);

  // Handle accepting challenge with mode
  const handleAcceptChallenge = () => {
    playClick();
    setShowModeModal(true);
  };

  const handleSelectMode = (mode: NecromancerMode) => {
    setNecroChallenge((prev) => ({
      ...prev,
      status: "active",
      mode,
      acceptedDate: new Date().toISOString(),
      requirement: { ...prev.requirement, current: 0 },
    }));
    
    toast({
      title: mode === "hard" ? "💀 HIGH-RISK CONTRACT ACCEPTED" : "🛡️ CHALLENGE ACCEPTED",
      description: mode === "hard" 
        ? "You have entered the Path of the Necromancer in Hard Mode. One mistake ends everything."
        : "You have entered the Path of the Necromancer. Complete 90 days to unlock the class.",
      duration: 5000,
    });
  };

  // Save necro challenge to localStorage - only after mount
  useEffect(() => {
    if (hasMounted) {
      localStorage.setItem("soloLevelingNecroChallenge", JSON.stringify(necroChallenge));
    }
  }, [necroChallenge, hasMounted]);

  const claimNecromancerReward = () => {
    if (necroChallenge.status !== "completed" || isNecromancerUnlocked) return;
    
    unlockClass("necromancer");
    
    // Apply additional rewards for hard mode
    if (necroChallenge.mode === "hard") {
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
    
    setNecroChallenge((prev) => ({
      ...prev,
      completedDate: new Date().toISOString(),
    }));
    
    playLevelUp();
  };

  const claimReward = (challengeId: string) => {
    const challenge = challenges.find((c) => c.id === challengeId);
    if (!challenge || challenge.status !== "completed") return;

    // Mark challenge as claimed for this period to prevent re-claiming
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentWeek = getWeekKey(now);
    const claimKey = challenge.type === "daily" ? `daily_${today}` : `weekly_${currentWeek}`;
    
    // Check if already claimed for this period
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
      // Add gems (implement addGems in usePlayerStats if needed)
      toast({
        title: "💎 Gems Earned!",
        description: `+${challenge.rewards.gems} Gems`,
      });
    }

    playSuccess();

    // Mark as claimed for this period
    setClaimedChallenges((prev) => ({
      ...prev,
      [claimKey]: new Date().toISOString(),
    }));

    // Remove completed challenge
    setChallenges((prev) => prev.filter((c) => c.id !== challengeId));

    toast({
      title: "🏆 Challenge Completed!",
      description: `${challenge.name} rewards claimed!`,
      duration: 4000,
    });
  };

  const activeChallenges = challenges.filter((c) => c.status === "active" || c.status === "completed");
  const necroProgressPercent = Math.min(100, (necroChallenge.requirement.current / necroChallenge.requirement.target) * 100);

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
            necroChallenge.status === "completed"
              ? "bg-gradient-to-br from-purple-900/30 to-red-900/30 border-purple-500 shadow-[0_0_30px_hsl(280_80%_40%/0.4)]"
              : necroChallenge.status === "pending"
              ? "bg-gradient-to-br from-purple-900/5 to-background border-purple-500/20 hover:border-purple-500/40"
              : "bg-gradient-to-br from-purple-900/10 to-background border-purple-500/30 hover:border-purple-500/50"
          }`}>
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
                <Skull className="w-10 h-10 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-2xl font-bold text-purple-400 font-cinzel">{necroChallenge.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    LEGENDARY
                  </span>
                  {necroChallenge.status === "active" && necroChallenge.mode && (
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      necroChallenge.mode === "hard" 
                        ? "bg-red-500/20 text-red-400 border-red-500/30" 
                        : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    }`}>
                      {necroChallenge.mode === "hard" ? "HARD MODE" : "NORMAL MODE"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{necroChallenge.description}</p>
              </div>
            </div>

            {/* Progress - Only show if active or completed */}
            {necroChallenge.status !== "pending" && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Streak Progress</span>
                  <span className="text-sm font-bold text-purple-400">
                    {necroChallenge.requirement.current} / {necroChallenge.requirement.target} days
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
                {necroChallenge.status === "pending" ? "Potential Rewards" : "Reward"}
              </p>
              {necroChallenge.status === "pending" ? (
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
              ) : necroChallenge.mode === "hard" ? (
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
            {necroChallenge.status === "pending" ? (
              <Button
                onClick={handleAcceptChallenge}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300 text-white"
              >
                <Skull className="w-4 h-4 mr-2" />
                Accept Challenge
              </Button>
            ) : necroChallenge.status === "completed" ? (
              <Button
                onClick={claimNecromancerReward}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300 text-white"
              >
                <Skull className="w-4 h-4 mr-2" />
                Claim Necromancer Class
              </Button>
            ) : (
              <div className="text-center py-2 text-sm text-muted-foreground">
                {Math.round(necroProgressPercent)}% Complete • {90 - necroChallenge.requirement.current} days remaining
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
