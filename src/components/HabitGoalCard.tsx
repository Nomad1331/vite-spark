import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Trophy, Skull, Trash2 } from "lucide-react";
import { Habit } from "@/lib/storage";

interface HabitGoalCardProps {
  habit: Habit;
  onComplete?: (habitId: string, won: boolean) => void;
  onDelete?: (habitId: string) => void;
}

const HabitGoalCard = ({ habit, onComplete, onDelete }: HabitGoalCardProps) => {
  const now = new Date();
  const start = new Date(habit.startDate);
  const daysElapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1; // +1 to include today
  const daysRemaining = Math.max(0, habit.goalDays - daysElapsed);
  
  // Calculate completion rate
  const completedDays = Object.values(habit.completionGrid).filter(Boolean).length;
  const completionRate = daysElapsed > 0 ? (completedDays / daysElapsed) * 100 : 0;
  
  // Check if habit period is complete (either time elapsed OR completed all goal days)
  const isPeriodComplete = daysRemaining === 0 || completedDays >= habit.goalDays;

  const getStatusColor = () => {
    if (habit.status === "won") return "text-neon-cyan";
    if (habit.status === "lost") return "text-destructive";
    return "text-neon-orange";
  };

  const getStatusIcon = () => {
    if (habit.status === "won") return <Trophy className="h-5 w-5" />;
    if (habit.status === "lost") return <Skull className="h-5 w-5" />;
    return <Flame className="h-5 w-5" />;
  };

  return (
    <Card className="p-4 border-border bg-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{habit.icon}</span>
          <h3 className="font-orbitron text-sm font-bold">{habit.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={getStatusColor()}>{getStatusIcon()}</div>
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(habit.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {habit.status === "active" && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Days Remaining</span>
              <span className="text-neon-orange font-bold">{daysRemaining} 🔥</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Completion</span>
              <span className="text-foreground font-bold">{completionRate.toFixed(0)}%</span>
            </div>

            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${completionRate}%`,
                  backgroundColor: habit.color,
                }}
              />
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Win</span>
                <span className="text-neon-cyan font-bold">{habit.winXP} XP</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Lose</span>
                <span className="text-destructive font-bold">{habit.loseXP} XP</span>
              </div>
            </div>

            {isPeriodComplete && onComplete && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  Manual override (auto-detection at {completionRate.toFixed(0)}%)
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-neon-cyan text-background hover:bg-neon-cyan/80"
                    onClick={() => onComplete(habit.id, true)}
                  >
                    Won ✓
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => onComplete(habit.id, false)}
                  >
                    Lost ✗
                  </Button>
                </div>
              </div>
            )}

            {!isPeriodComplete && daysRemaining <= 3 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground text-center">
                  Auto-finalizes when complete (95% = win)
                </p>
              </div>
            )}
          </>
        )}

        {habit.status === "won" && (
          <div className="text-center py-2">
            <div className="text-neon-cyan font-bold text-lg">Victory!</div>
            <div className="text-muted-foreground text-xs">+{habit.winXP} XP Earned</div>
          </div>
        )}

        {habit.status === "lost" && (
          <div className="text-center py-2">
            <div className="text-destructive font-bold text-lg">Defeated</div>
            <div className="text-muted-foreground text-xs">-{habit.loseXP} XP Lost</div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default HabitGoalCard;
