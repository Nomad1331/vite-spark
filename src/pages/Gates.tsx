import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useCloudGates } from "@/hooks/useCloudGates";
import { useCloudQuests } from "@/hooks/useCloudQuests";
import { useCloudHabits } from "@/hooks/useCloudHabits";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Skull, Lock, Trophy, Flame, AlertTriangle, Loader2 } from "lucide-react";

const RANK_COLORS: Record<string, string> = {
  "E-Rank": "text-gray-400 border-gray-400/50",
  "D-Rank": "text-green-400 border-green-400/50",
  "C-Rank": "text-blue-400 border-blue-400/50",
  "B-Rank": "text-purple-400 border-purple-400/50",
  "A-Rank": "text-yellow-400 border-yellow-400/50",
  "S-Rank": "text-red-400 border-red-400/50",
};

const RANK_GLOW: Record<string, string> = {
  "E-Rank": "shadow-[0_0_20px_rgba(156,163,175,0.3)]",
  "D-Rank": "shadow-[0_0_20px_rgba(74,222,128,0.3)]",
  "C-Rank": "shadow-[0_0_20px_rgba(96,165,250,0.3)]",
  "B-Rank": "shadow-[0_0_20px_rgba(192,132,252,0.3)]",
  "A-Rank": "shadow-[0_0_20px_rgba(250,204,21,0.3)]",
  "S-Rank": "shadow-[0_0_20px_rgba(248,113,113,0.3)]",
};

const Gates = () => {
  const { user } = useAuth();
  const { stats, addXP, addGold, applyGatePenalty } = usePlayerStats();
  const { gates, loading, checkUnlocks, enterGate, markDayComplete, completeGate, failGate, rechallengeGate, updateGates } = useCloudGates();
  const { quests } = useCloudQuests();
  const { habits } = useCloudHabits();

  // Check gate unlock status based on player level
  useEffect(() => {
    if (stats.level > 0) {
      checkUnlocks(stats.level);
    }
  }, [stats.level, checkUnlocks]);

  // Auto-check daily challenge completion for active gates
  useEffect(() => {
    if (gates.length === 0) return;
    
    const today = new Date().toISOString().split("T")[0];
    
    const updatedGates = gates.map((gate) => {
      // Only auto-check for gates that are started and haven't completed today
      if (gate.startDate && gate.status === "active" && !gate.progress[today]) {
        // Check if all quests are completed
        const allQuestsComplete = quests.length > 0 && quests.every(q => q.completed);
        
        // Check habits requirement based on gate's requiredHabits
        const activeHabits = habits.filter(h => h.status === "active");
        const completedHabitsToday = activeHabits.filter(h => h.completionGrid[today]).length;
        
        // Gate requires: all quests complete + at least requiredHabits habits completed
        const habitsRequirementMet = gate.requiredHabits === 0 || 
          (activeHabits.length >= gate.requiredHabits && completedHabitsToday >= gate.requiredHabits);
        
        const challengeMet = allQuestsComplete && habitsRequirementMet;
        
        if (challengeMet) {
          const newProgress = { ...gate.progress, [today]: true };
          const completedDays = Object.values(newProgress).filter(Boolean).length;
          
          // Auto-complete gate if all required days are done
          if (completedDays === gate.requiredDays) {
            setTimeout(() => handleCompleteGate(gate.id), 100);
          }
          
          return { ...gate, progress: newProgress };
        }
      }
      return gate;
    });
    
    // Check if any gates were updated
    const changed = updatedGates.some((g, i) => 
      JSON.stringify(g.progress) !== JSON.stringify(gates[i].progress)
    );
    
    if (changed) {
      updateGates(updatedGates);
    }
  }, [quests, habits, gates.length]);

  const handleEnterGate = async (gateId: string) => {
    const gate = gates.find((g) => g.id === gateId);
    if (!gate) return;

    // Check level requirement to enter any gate
    if (stats.level < 3) {
      toast({
        title: "⚠️ ACCESS DENIED",
        description: "You must reach Level 3 to enter Gates. Complete more quests to level up!",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    // Check if another gate is already active
    const activeGate = gates.find((g) => g.status === "active" && g.startDate !== null);
    if (activeGate && activeGate.id !== gateId) {
      toast({
        title: "⚠️ GATE RESTRICTION",
        description: `You cannot enter multiple gates simultaneously. Complete or abandon "${activeGate.name}" first.`,
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    await enterGate(gateId);
    toast({
      title: "⚔️ GATE ENTERED",
      description: `Your ${gate.requiredDays}-day challenge has begun! Complete your daily challenge to progress.`,
    });
  };

  const handleCompleteGate = async (gateId: string) => {
    const gate = await completeGate(gateId);
    if (!gate) return;

    addXP(gate.rewards.xp, {
      type: "gate",
      description: `Cleared ${gate.name}`,
    });
    addGold(gate.rewards.gold);

    toast({
      title: `🏆 ${gate.rank} GATE CLEARED!`,
      description: `+${gate.rewards.xp} XP, +${gate.rewards.gold} Gold${gate.rewards.title ? `, Title: "${gate.rewards.title}"` : ""}`,
      duration: 5000,
    });
  };

  const handleFailGate = async (gateId: string) => {
    const gate = await failGate(gateId);
    if (!gate) return;

    // Apply harsh penalties after updating gate state
    setTimeout(() => {
      applyGatePenalty();
      
      toast({
        title: "💀 GATE FAILED",
        description: `The ${gate.name} has defeated you. Harsh penalties applied: -10% XP, -10% Credits, -5 all stats, -1 level.`,
        variant: "destructive",
        duration: 7000,
      });
    }, 100);
  };

  const handleRechallenge = async (gateId: string) => {
    await rechallengeGate(gateId);
  };

  const getDaysCompleted = (gate: typeof gates[0]) => {
    return Object.values(gate.progress).filter(Boolean).length;
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 pt-24 text-center">
        <h1 className="text-2xl font-bold text-primary mb-4">Please Sign In</h1>
        <p className="text-muted-foreground">You need to be signed in to view Gates.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 pt-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading gates...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pt-24">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-4xl font-bold text-destructive mb-2 font-cinzel"
          style={{ textShadow: "0 0 10px hsl(var(--destructive) / 0.8)" }}
        >
          GATES
        </h1>
        <p className="text-muted-foreground">
          Multi-day commitment challenges. Clear gates to earn massive rewards. Daily challenges auto-complete when requirements are met.
        </p>
      </div>

      {/* System Warning */}
      <Card className="p-4 bg-destructive/10 border-destructive/30 mb-8">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-destructive" />
          <div>
            <p className="text-destructive font-bold">⚠️ SYSTEM NOTICE</p>
            <p className="text-sm text-muted-foreground">
              Gates are dangerous. Complete your daily challenge for the required consecutive days to clear. Only one gate can be active at a time. Failure results in harsh penalties: -10% XP, -10% Credits, -5 all stats, -1 level.
            </p>
          </div>
        </div>
      </Card>

      {/* Gates Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {gates.map((gate) => {
          const isLocked = gate.status === "locked";
          const isActive = gate.status === "active";
          const isCompleted = gate.status === "completed";
          const isFailed = gate.status === "failed";
          const hasStarted = gate.startDate !== null;
          const daysCompleted = getDaysCompleted(gate);
          const today = new Date().toISOString().split("T")[0];
          const isTodayComplete = gate.progress[today] === true;

          return (
            <Card
              key={gate.id}
              className={`p-6 transition-all duration-300 ${
                isLocked
                  ? "bg-muted/30 border-muted opacity-60"
                  : isCompleted
                  ? "bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/50"
                  : isFailed
                  ? "bg-destructive/10 border-destructive/30"
                  : `bg-card border-border hover:border-primary/30 ${RANK_GLOW[gate.rank]}`
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {isLocked ? (
                    <Lock className="w-8 h-8 text-muted-foreground" />
                  ) : isCompleted ? (
                    <Trophy className="w-8 h-8 text-primary" />
                  ) : (
                    <Skull className={`w-8 h-8 ${RANK_COLORS[gate.rank]?.split(" ")[0] || "text-gray-400"}`} />
                  )}
                  <div>
                    <h3 className={`text-xl font-bold font-cinzel ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                      {gate.name}
                    </h3>
                    <span
                      className={`text-sm font-bold px-2 py-0.5 rounded border ${RANK_COLORS[gate.rank] || "text-gray-400 border-gray-400/50"}`}
                    >
                      {gate.rank}
                    </span>
                  </div>
                </div>
                {gate.losses > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Losses</p>
                    <p className="text-lg font-bold text-destructive">{gate.losses}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground mb-2">{gate.description}</p>
              <p className={`text-xs italic mb-4 ${isFailed ? "text-destructive" : "text-muted-foreground"}`}>
                {gate.loreText}
              </p>

              {/* Challenge */}
              <div className="p-3 bg-background/50 border border-border rounded-lg mb-4">
                <p className="text-xs text-muted-foreground mb-1">Daily Challenge (Auto-completes)</p>
                <p className="text-sm font-semibold text-foreground">{gate.dailyChallenge}</p>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>📅 {gate.requiredDays} days</span>
                  <span>🎯 {gate.requiredHabits} habits required</span>
                </div>
              </div>

              {/* 7-Day Progress */}
              {hasStarted && !isCompleted && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-muted-foreground">Progress</p>
                    <div className="flex items-center gap-2">
                      {isTodayComplete && (
                        <span className="text-xs text-primary">✓ Today Complete</span>
                      )}
                      <p className="text-sm font-bold text-primary">
                        {daysCompleted} / {gate.requiredDays} Days
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {Array.from({ length: gate.requiredDays }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-8 border-2 rounded flex items-center justify-center ${
                          i < daysCompleted
                            ? "bg-primary/20 border-primary text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {i < daysCompleted ? "✓" : i + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rewards */}
              <div className="p-3 bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/20 rounded-lg mb-4">
                <p className="text-xs text-muted-foreground mb-2">Rewards</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-primary font-bold">+{gate.rewards.xp} XP</span>
                  <span className="text-yellow-400 font-bold">💰 {gate.rewards.gold}</span>
                  {gate.rewards.title && (
                    <span className="text-secondary font-bold">🏆 {gate.rewards.title}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {isLocked && (
                  <Button disabled className="w-full" variant="outline">
                    <Lock className="w-4 h-4 mr-2" />
                    Requires Level {gate.unlockRequirement.level}
                  </Button>
                )}

                {isActive && !hasStarted && (
                  <Button
                    onClick={() => handleEnterGate(gate.id)}
                    className="w-full bg-gradient-to-r from-destructive to-destructive/70 hover:from-destructive/80 hover:to-destructive/60"
                  >
                    <Flame className="w-4 h-4 mr-2" />
                    Enter Gate
                  </Button>
                )}

                {hasStarted && !isCompleted && !isFailed && (
                  <Button onClick={() => handleFailGate(gate.id)} variant="destructive" className="w-full">
                    Abandon Gate (Harsh Penalty)
                  </Button>
                )}

                {isCompleted && (
                  <Button disabled className="w-full bg-primary/20 text-primary" variant="outline">
                    <Trophy className="w-4 h-4 mr-2" />
                    Cleared
                  </Button>
                )}

                {isFailed && (
                  <Button
                    onClick={() => handleRechallenge(gate.id)}
                    className="w-full bg-gradient-to-r from-destructive to-destructive/70"
                  >
                    Rechallenge
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Gates;
