import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { storage, Habit } from "@/lib/storage";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { toast } from "@/hooks/use-toast";
import { getTodayString } from "@/lib/dateUtils";
import HabitGrid from "@/components/HabitGrid";
import HabitGoalCard from "@/components/HabitGoalCard";
import { TimezoneClock } from "@/components/TimezoneClock";
import { HabitStatistics } from "@/components/HabitStatistics";
import { Plus, Trash2 } from "lucide-react";

const HABIT_ICONS = ["🌱", "💪", "📚", "🧘", "🎯", "🏃", "💻", "🎨", "🎵", "💧"];
const HABIT_COLORS = [
  "hsl(120, 60%, 50%)", // green
  "hsl(25, 100%, 60%)", // orange
  "hsl(200, 80%, 50%)", // blue
  "hsl(270, 70%, 60%)", // purple
  "hsl(350, 80%, 60%)", // red
];

// Anti-exploit constants
const MIN_GOAL_DAYS = 7; // Minimum days for a habit
const MAX_HABITS_PER_DAY = 5; // Maximum habits that can be created per day
const CREATION_COOLDOWN_KEY = "habit_creation_log";

// Formula-based XP calculation to prevent exploitation
const calculateHabitXP = (days: number) => ({
  winXP: days * 20,
  loseXP: days * 10,
});

// Get habits created today for rate limiting
const getHabitsCreatedToday = (): number => {
  const log = localStorage.getItem(CREATION_COOLDOWN_KEY);
  if (!log) return 0;
  
  try {
    const { date, count } = JSON.parse(log);
    const today = new Date().toISOString().split("T")[0];
    return date === today ? count : 0;
  } catch {
    return 0;
  }
};

// Increment habits created today
const incrementHabitsCreatedToday = () => {
  const today = new Date().toISOString().split("T")[0];
  const currentCount = getHabitsCreatedToday();
  localStorage.setItem(CREATION_COOLDOWN_KEY, JSON.stringify({ date: today, count: currentCount + 1 }));
};

const Habits = () => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState({
    name: "",
    icon: "🌱",
    color: HABIT_COLORS[0],
    goalDays: MIN_GOAL_DAYS, // Default to minimum
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { addXP } = usePlayerStats();

  useEffect(() => {
    const loadedHabits = storage.getHabits();
    setHabits(loadedHabits);
    
    // Auto-check for completed habits and determine win/loss
    checkAndFinalizeHabits(loadedHabits);
  }, []);

  const saveHabits = (updatedHabits: Habit[]) => {
    storage.setHabits(updatedHabits);
    setHabits(updatedHabits);
  };

  const createHabit = () => {
    if (!newHabit.name.trim()) {
      toast({ title: "Error", description: "Habit name is required", variant: "destructive" });
      return;
    }

    // Anti-exploit: Rate limiting - check daily creation limit
    const habitsCreatedToday = getHabitsCreatedToday();
    if (habitsCreatedToday >= MAX_HABITS_PER_DAY) {
      toast({ 
        title: "Daily Limit Reached", 
        description: `You can only create ${MAX_HABITS_PER_DAY} habits per day. Try again tomorrow!`, 
        variant: "destructive" 
      });
      return;
    }

    // Anti-exploit: Enforce minimum goal days
    const safeDays = Math.max(MIN_GOAL_DAYS, newHabit.goalDays);
    const xpValues = calculateHabitXP(safeDays);
    
    const habit: Habit = {
      id: Date.now().toString(),
      name: newHabit.name,
      icon: newHabit.icon,
      color: newHabit.color,
      completionGrid: {},
      goalDays: safeDays,
      winXP: xpValues.winXP,
      loseXP: xpValues.loseXP,
      startDate: new Date().toISOString().split("T")[0],
      endDate: null,
      status: "active",
    };

    // Increment rate limit counter
    incrementHabitsCreatedToday();

    saveHabits([...habits, habit]);
    setIsDialogOpen(false);
    setNewHabit({
      name: "",
      icon: "🌱",
      color: HABIT_COLORS[0],
      goalDays: MIN_GOAL_DAYS,
    });

    toast({
      title: "⚡ Habit Created",
      description: `${habit.icon} ${habit.name} - ${habit.goalDays} day challenge! (Win: +${xpValues.winXP} XP / Lose: -${xpValues.loseXP} XP)`,
    });
  };

  const toggleDayCompletion = (habitId: string, date?: string) => {
    const dateStr = date || getTodayString();
    const updated = habits.map((h) => {
      if (h.id === habitId) {
        const newGrid = { ...h.completionGrid };
        newGrid[dateStr] = !newGrid[dateStr];
        return { ...h, completionGrid: newGrid };
      }
      return h;
    });
    saveHabits(updated);

    toast({
      title: updated.find((h) => h.id === habitId)?.completionGrid[dateStr] ? "✓ Completed" : "Unchecked",
      description: "Progress updated",
    });

    // Check if this completion triggers habit finalization
    checkAndFinalizeHabits(updated);
  };

  // Auto-finalize habits that have reached their end date
  const checkAndFinalizeHabits = (habitsToCheck: Habit[]) => {
    const now = new Date();
    const nowStr = now.toISOString().split("T")[0];
    let updated = false;
    let habitsToFinalize: { habit: Habit; won: boolean }[] = [];

    const updatedHabits = habitsToCheck.map((habit) => {
      if (habit.status !== "active") return habit;

      const start = new Date(habit.startDate);
      // Calculate the end date of the habit period (startDate + goalDays - 1)
      const endDate = new Date(start);
      endDate.setDate(endDate.getDate() + habit.goalDays - 1);
      endDate.setHours(23, 59, 59, 999); // End of the last day
      
      const completedDays = Object.values(habit.completionGrid).filter(Boolean).length;
      
      // Only finalize if:
      // 1. User completed all required days (early win), OR
      // 2. The habit period has FULLY elapsed (past end date)
      const hasCompletedAllDays = completedDays >= habit.goalDays;
      const hasPeriodFullyElapsed = now > endDate;
      
      if (hasCompletedAllDays) {
        // Early win - user completed all days before period ended
        updated = true;
        habitsToFinalize.push({ habit, won: true });
        
        return {
          ...habit,
          status: "won" as const,
          endDate: nowStr,
        };
      } else if (hasPeriodFullyElapsed) {
        // Period ended - check completion rate
        const completionRate = completedDays / habit.goalDays;
        const won = completionRate >= 0.95;
        
        updated = true;
        habitsToFinalize.push({ habit, won });
        
        return {
          ...habit,
          status: won ? "won" : "lost",
          endDate: nowStr,
        } as Habit;
      }
      
      return habit;
    });

    if (updated) {
      saveHabits(updatedHabits);
      
      // Award/deduct XP and show toasts
      habitsToFinalize.forEach(({ habit, won }) => {
        if (won) {
          addXP(habit.winXP, {
            type: "habit",
            description: `${habit.icon} ${habit.name} - Victory!`
          });
          toast({
            title: "🏆 VICTORY!",
            description: `${habit.icon} ${habit.name} completed! +${habit.winXP} XP`,
            duration: 5000,
          });
        } else {
          addXP(-habit.loseXP, {
            type: "habit",
            description: `${habit.icon} ${habit.name} - Defeated`
          });
          toast({
            title: "💀 Defeated",
            description: `${habit.icon} ${habit.name} lost. -${habit.loseXP} XP`,
            variant: "destructive",
            duration: 5000,
          });
        }
      });
    }
  };

  const completeHabit = (habitId: string, won: boolean) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    const updated = habits.map((h) => {
      if (h.id === habitId) {
        return {
          ...h,
          status: won ? "won" : "lost",
          endDate: new Date().toISOString().split("T")[0],
        } as Habit;
      }
      return h;
    });

    saveHabits(updated);

    // Grant/deduct XP immediately
    if (won) {
      addXP(habit.winXP, {
        type: "habit",
        description: `${habit.icon} ${habit.name} - Victory!`
      });
      toast({
        title: "🏆 VICTORY!",
        description: `${habit.icon} ${habit.name} completed! +${habit.winXP} XP`,
        duration: 5000,
      });
    } else {
      addXP(-habit.loseXP, {
        type: "habit",
        description: `${habit.icon} ${habit.name} - Defeated`
      });
      toast({
        title: "💀 Defeated",
        description: `${habit.icon} ${habit.name} lost. -${habit.loseXP} XP`,
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const deleteHabit = (habitId: string) => {
    saveHabits(habits.filter((h) => h.id !== habitId));
    toast({ title: "Habit Deleted", description: "Habit removed from tracking" });
  };

  const activeHabits = habits.filter((h) => h.status === "active");
  const completedHabits = habits.filter((h) => h.status !== "active");
  const todayStr = getTodayString();

  return (
    <div className="container mx-auto px-4 py-8 pt-24">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1
          className="text-4xl font-bold text-neon-orange font-cinzel"
          style={{ textShadow: "0 0 10px hsl(var(--neon-orange) / 0.8)" }}
        >
          HABITS
        </h1>

        <div className="flex items-center gap-3">
          <TimezoneClock />
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-neon-cyan text-background hover:bg-neon-cyan/80">
              <Plus className="mr-2 h-4 w-4" /> New Habit
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-orbitron text-neon-cyan">Create New Habit</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Set up a new habit challenge with win/lose stakes
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Habit Name</Label>
                <Input
                  value={newHabit.name}
                  onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                  placeholder="e.g., Morning Workout"
                  className="bg-background border-border"
                />
              </div>

              <div>
                <Label>Icon</Label>
                <div className="flex gap-2 flex-wrap">
                  {HABIT_ICONS.map((icon) => (
                    <button
                      key={icon}
                      className={`text-2xl p-2 rounded border ${
                        newHabit.icon === icon ? "border-neon-cyan bg-neon-cyan/10" : "border-border"
                      }`}
                      onClick={() => setNewHabit({ ...newHabit, icon })}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Color</Label>
                <div className="flex gap-2">
                  {HABIT_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`h-8 w-8 rounded-full border-2 ${
                        newHabit.color === color ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewHabit({ ...newHabit, color })}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Goal Days (minimum {MIN_GOAL_DAYS})</Label>
                  <Input
                    type="number"
                    min={MIN_GOAL_DAYS}
                    max="365"
                    value={newHabit.goalDays}
                    onChange={(e) => setNewHabit({ ...newHabit, goalDays: Math.max(MIN_GOAL_DAYS, Math.min(365, parseInt(e.target.value) || MIN_GOAL_DAYS)) })}
                    className="bg-background border-border"
                  />
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground mb-2">XP Stakes (based on {Math.max(MIN_GOAL_DAYS, newHabit.goalDays)} days)</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-neon-cyan">Win: +{calculateHabitXP(Math.max(MIN_GOAL_DAYS, newHabit.goalDays)).winXP} XP</span>
                    <span className="text-destructive">Lose: -{calculateHabitXP(Math.max(MIN_GOAL_DAYS, newHabit.goalDays)).loseXP} XP</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Formula: Win = Days × 20, Lose = Days × 10</p>
                  <p className="text-xs text-yellow-500 mt-1">⚠️ Limit: {MAX_HABITS_PER_DAY} new habits per day</p>
                </div>
              </div>

              <Button onClick={createHabit} className="w-full bg-neon-cyan text-background hover:bg-neon-cyan/80">
                Create Habit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs defaultValue="month" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-4 mb-6">
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="space-y-6">
          {activeHabits.length === 0 ? (
            <Card className="p-8 bg-card border-border text-center">
              <p className="text-muted-foreground">No active habits. Create one to get started!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeHabits.map((habit) => (
                <Card key={habit.id} className="p-6 bg-card border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{habit.icon}</span>
                      <h3 className="font-orbitron font-bold text-lg">{habit.name}</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteHabit(habit.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <HabitGrid
                    completionGrid={habit.completionGrid}
                    startDate={habit.startDate}
                    color={habit.color}
                    daysToShow={habit.goalDays}
                    onDateClick={(date) => toggleDayCompletion(habit.id, date)}
                  />

                  <div className="mt-4 flex items-center justify-between">
                    <Button
                      size="sm"
                      variant={habit.completionGrid[todayStr] ? "secondary" : "default"}
                      onClick={() => toggleDayCompletion(habit.id)}
                      className={
                        habit.completionGrid[todayStr]
                          ? ""
                          : "bg-neon-cyan text-background hover:bg-neon-cyan/80"
                      }
                    >
                      {habit.completionGrid[todayStr] ? "Done ✓" : "Mark Today"}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {Object.values(habit.completionGrid).filter(Boolean).length} / {habit.goalDays} days
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <h2 className="text-2xl font-orbitron font-bold mb-4">Today's Habits</h2>
          {activeHabits.length === 0 ? (
            <Card className="p-8 bg-card border-border text-center">
              <p className="text-muted-foreground">No active habits for today</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {activeHabits.map((habit) => (
                <Card key={habit.id} className="p-4 bg-card border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{habit.icon}</span>
                      <div>
                        <h3 className="font-orbitron font-bold">{habit.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Day {Object.values(habit.completionGrid).filter(Boolean).length + 1} of {habit.goalDays}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={habit.completionGrid[todayStr] ? "secondary" : "default"}
                      onClick={() => toggleDayCompletion(habit.id)}
                      className={
                        habit.completionGrid[todayStr]
                          ? ""
                          : "bg-neon-cyan text-background hover:bg-neon-cyan/80"
                      }
                    >
                      {habit.completionGrid[todayStr] ? "Completed ✓" : "Complete"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <div>
            <h2 className="text-2xl font-orbitron font-bold mb-4">Active Goals</h2>
            {activeHabits.length === 0 ? (
              <Card className="p-8 bg-card border-border text-center">
                <p className="text-muted-foreground">No active goals</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeHabits.map((habit) => (
                  <HabitGoalCard
                    key={habit.id}
                    habit={habit}
                    onComplete={() => completeHabit(habit.id, true)}
                    onLose={() => completeHabit(habit.id, false)}
                  />
                ))}
              </div>
            )}
          </div>

          {completedHabits.length > 0 && (
            <div>
              <h2 className="text-2xl font-orbitron font-bold mb-4">Completed</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedHabits.map((habit) => (
                  <HabitGoalCard key={habit.id} habit={habit} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats">
          <HabitStatistics habits={habits} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Habits;
