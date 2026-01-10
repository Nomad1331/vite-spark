import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Habit } from "@/lib/storage";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useCloudHabits } from "@/hooks/useCloudHabits";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { getTodayString } from "@/lib/dateUtils";
import HabitGrid from "@/components/HabitGrid";
import HabitGoalCard from "@/components/HabitGoalCard";
import HabitCalendarView from "@/components/HabitCalendarView";
import { TimezoneClock } from "@/components/TimezoneClock";
import { HabitStatistics } from "@/components/HabitStatistics";
import { Plus, Trash2, Calendar, Loader2 } from "lucide-react";

const HABIT_ICONS = ["🌱", "💪", "📚", "🧘", "🎯", "🏃", "💻", "🎨", "🎵", "💧"];
const HABIT_COLORS = [
  "hsl(120, 60%, 50%)", "hsl(25, 100%, 60%)", "hsl(200, 80%, 50%)",
  "hsl(270, 70%, 60%)", "hsl(350, 80%, 60%)",
];

const MIN_GOAL_DAYS = 7;
const MAX_HABITS_PER_DAY = 5;

const calculateHabitXP = (days: number) => ({
  winXP: days * 20,
  loseXP: days * 10,
});

// Track shown defeat toasts in sessionStorage to prevent spam
const SHOWN_DEFEAT_TOASTS_KEY = "soloLevelingShownDefeatToasts";

const getShownDefeatToasts = (): string[] => {
  const stored = sessionStorage.getItem(SHOWN_DEFEAT_TOASTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

const markDefeatToastShown = (habitId: string) => {
  const shown = getShownDefeatToasts();
  if (!shown.includes(habitId)) {
    sessionStorage.setItem(SHOWN_DEFEAT_TOASTS_KEY, JSON.stringify([...shown, habitId]));
  }
};

const Habits = () => {
  const { user } = useAuth();
  const { habits, loading, createHabit: cloudCreateHabit, toggleDayCompletion: cloudToggleDayCompletion, completeHabit: cloudCompleteHabit, deleteHabit: cloudDeleteHabit, finalizeHabits } = useCloudHabits();
  const { addXP } = usePlayerStats();

  const [newHabit, setNewHabit] = useState({
    name: "",
    icon: "🌱",
    color: HABIT_COLORS[0],
    goalDays: MIN_GOAL_DAYS,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [habitsCreatedToday, setHabitsCreatedToday] = useState(0);

  // Check and finalize habits on load
  useEffect(() => {
    if (!user || loading || habits.length === 0) return;
    
    const checkHabits = async () => {
      const finalized = await finalizeHabits();
      const shownDefeatToasts = getShownDefeatToasts();
      
      finalized.forEach(({ habit, won }) => {
        if (won) {
          addXP(habit.winXP, { type: "habit", description: `${habit.icon} ${habit.name} - Victory!` });
          toast({
            title: "🏆 VICTORY!",
            description: `${habit.icon} ${habit.name} completed! +${habit.winXP} XP`,
            duration: 5000,
          });
        } else if (!shownDefeatToasts.includes(habit.id)) {
          addXP(-habit.loseXP, { type: "habit", description: `${habit.icon} ${habit.name} - Defeated` });
          toast({
            title: "💀 Defeated",
            description: `${habit.icon} ${habit.name} lost. -${habit.loseXP} XP`,
            variant: "destructive",
            duration: 5000,
          });
          markDefeatToastShown(habit.id);
        }
      });
    };
    
    checkHabits();
  }, [user, loading, habits.length]);

  const createHabit = async () => {
    if (!newHabit.name.trim()) {
      toast({ title: "Error", description: "Habit name is required", variant: "destructive" });
      return;
    }

    if (habitsCreatedToday >= MAX_HABITS_PER_DAY) {
      toast({ title: "Daily Limit Reached", description: `You can only create ${MAX_HABITS_PER_DAY} habits per day.`, variant: "destructive" });
      return;
    }

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

    await cloudCreateHabit(habit);
    setHabitsCreatedToday(prev => prev + 1);
    setIsDialogOpen(false);
    setNewHabit({ name: "", icon: "🌱", color: HABIT_COLORS[0], goalDays: MIN_GOAL_DAYS });

    toast({
      title: "⚡ Habit Created",
      description: `${habit.icon} ${habit.name} - ${habit.goalDays} day challenge! (Win: +${xpValues.winXP} XP / Lose: -${xpValues.loseXP} XP)`,
    });
  };

  const toggleDayCompletion = async (habitId: string, date?: string) => {
    const dateStr = date || getTodayString();
    const updatedHabit = await cloudToggleDayCompletion(habitId, dateStr);

    toast({
      title: updatedHabit?.completionGrid[dateStr] ? "✓ Completed" : "Unchecked",
      description: "Progress updated",
    });
  };

  const completeHabit = async (habitId: string, won: boolean) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    await cloudCompleteHabit(habitId, won);

    if (won) {
      addXP(habit.winXP, { type: "habit", description: `${habit.icon} ${habit.name} - Victory!` });
      toast({ title: "🏆 VICTORY!", description: `${habit.icon} ${habit.name} completed! +${habit.winXP} XP`, duration: 5000 });
    } else {
      addXP(-habit.loseXP, { type: "habit", description: `${habit.icon} ${habit.name} - Defeated` });
      toast({ title: "💀 Defeated", description: `${habit.icon} ${habit.name} lost. -${habit.loseXP} XP`, variant: "destructive", duration: 5000 });
    }
  };

  const deleteHabit = async (habitId: string) => {
    await cloudDeleteHabit(habitId);
    toast({ title: "Habit Deleted", description: "Habit removed from tracking" });
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 pt-24 text-center">
        <h1 className="text-2xl font-bold text-primary mb-4">Please Sign In</h1>
        <p className="text-muted-foreground">You need to be signed in to view your habits.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 pt-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading habits...</span>
      </div>
    );
  }

  const activeHabits = habits.filter((h) => h.status === "active");
  const completedHabits = habits.filter((h) => h.status !== "active");
  const todayStr = getTodayString();

  return (
    <div className="container mx-auto px-4 py-8 pt-24">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-4xl font-bold text-neon-orange font-cinzel" style={{ textShadow: "0 0 10px hsl(var(--neon-orange) / 0.8)" }}>
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
                        className={`text-2xl p-2 rounded border ${newHabit.icon === icon ? "border-neon-cyan bg-neon-cyan/10" : "border-border"}`}
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
                        className={`h-8 w-8 rounded-full border-2 ${newHabit.color === color ? "border-foreground" : "border-transparent"}`}
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

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-5 mb-6">
          <TabsTrigger value="calendar" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-6">
          <HabitCalendarView habits={habits} onToggle={toggleDayCompletion} />
        </TabsContent>

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
                    <Button size="sm" variant="ghost" onClick={() => deleteHabit(habit.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
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
                      className={habit.completionGrid[todayStr] ? "" : "bg-neon-cyan text-background hover:bg-neon-cyan/80"}
                    >
                      {habit.completionGrid[todayStr] ? "Undo Today" : "✓ Mark Today"}
                    </Button>

                    <div className="text-sm text-muted-foreground">
                      {Object.values(habit.completionGrid).filter(Boolean).length} / {habit.goalDays} days
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <Card className="p-6 bg-card border-border">
            <h3 className="text-xl font-bold text-foreground mb-4">Today's Tasks</h3>
            {activeHabits.length === 0 ? (
              <p className="text-muted-foreground">No active habits for today.</p>
            ) : (
              <div className="space-y-3">
                {activeHabits.map((habit) => (
                  <div key={habit.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{habit.icon}</span>
                      <span className={habit.completionGrid[todayStr] ? "line-through text-muted-foreground" : "text-foreground"}>
                        {habit.name}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={habit.completionGrid[todayStr] ? "ghost" : "default"}
                      onClick={() => toggleDayCompletion(habit.id)}
                      className={habit.completionGrid[todayStr] ? "" : "bg-neon-cyan text-background hover:bg-neon-cyan/80"}
                    >
                      {habit.completionGrid[todayStr] ? "✓" : "Complete"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {habits.map((habit) => (
              <HabitGoalCard
                key={habit.id}
                habit={habit}
                onComplete={(habitId, won) => completeHabit(habitId, won)}
                onDelete={(habitId) => deleteHabit(habitId)}
              />
            ))}
          </div>

          {habits.length === 0 && (
            <Card className="p-8 bg-card border-border text-center">
              <p className="text-muted-foreground">No habits yet. Create one to start your journey!</p>
            </Card>
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
