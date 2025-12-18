import { useState } from 'react';
import { useGuildChallenges, GuildChallenge } from '@/hooks/useGuildChallenges';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Target, Trophy, Clock, Plus, Gift, Coins, Zap,
  Users, CheckCircle, Flame
} from 'lucide-react';

interface GuildChallengesPanelProps {
  guildId: string | null;
  isLeader: boolean;
}

const GuildChallengesPanel = ({ guildId, isLeader }: GuildChallengesPanelProps) => {
  const { challenges, contributions, loading, createChallenge, contribute } = useGuildChallenges(guildId);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState(100);
  const [rewardXp, setRewardXp] = useState(500);
  const [rewardGold, setRewardGold] = useState(100);
  const [contributionAmount, setContributionAmount] = useState<Record<string, number>>({});

  const handleCreate = async () => {
    if (!title.trim()) return;
    const success = await createChallenge(title, description, targetValue, rewardXp, rewardGold);
    if (success) {
      setCreateModalOpen(false);
      setTitle('');
      setDescription('');
      setTargetValue(100);
      setRewardXp(500);
      setRewardGold(100);
    }
  };

  const handleContribute = async (challengeId: string) => {
    const amount = contributionAmount[challengeId] || 1;
    await contribute(challengeId, amount);
    setContributionAmount(prev => ({ ...prev, [challengeId]: 1 }));
  };

  const getTimeRemaining = (endsAt: string) => {
    const now = new Date();
    const end = new Date(endsAt);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  const activeChallenges = challenges.filter(c => !c.is_completed);
  const completedChallenges = challenges.filter(c => c.is_completed);

  if (!guildId) return null;

  return (
    <Card className="border-border/50 bg-gradient-to-br from-slate-900 to-slate-950 overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-cinzel">
              <Target className="h-5 w-5 text-primary" />
              Guild Challenges
            </CardTitle>
            <CardDescription>Work together for bonus rewards!</CardDescription>
          </div>
          {isLeader && (
            <Button 
              size="sm" 
              onClick={() => setCreateModalOpen(true)}
              className="bg-cyan-500 hover:bg-cyan-400 hover:shadow-[0_0_15px_hsl(186_100%_50%/0.5)] transition-all"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : activeChallenges.length === 0 && completedChallenges.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl">
            <div className="relative inline-block mb-4">
              <Target className="h-16 w-16 text-cyan-500/50 animate-pulse" />
              <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
            </div>
            <p className="text-xl font-cinzel text-cyan-400 mb-2">
              {isLeader ? 'Create a challenge' : 'No challenges yet'}
            </p>
            <p className="text-sm text-slate-400">
              Set goals and compete together
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Challenges */}
            {activeChallenges.map((challenge) => (
              <div 
                key={challenge.id}
                className="p-4 rounded-lg border border-primary/30 bg-primary/5"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-400" />
                      {challenge.title}
                    </h4>
                    {challenge.description && (
                      <p className="text-sm text-muted-foreground mt-1">{challenge.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getTimeRemaining(challenge.ends_at)}
                  </Badge>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span className="font-mono">
                      {challenge.current_value} / {challenge.target_value}
                    </span>
                  </div>
                  <Progress 
                    value={(challenge.current_value / challenge.target_value) * 100} 
                    className="h-3"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1 text-cyan-400">
                      <Zap className="h-4 w-4" />
                      +{challenge.reward_xp} XP
                    </span>
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Coins className="h-4 w-4" />
                      +{challenge.reward_gold}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={contributionAmount[challenge.id] || 1}
                      onChange={(e) => setContributionAmount(prev => ({
                        ...prev,
                        [challenge.id]: parseInt(e.target.value) || 1
                      }))}
                      className="w-20 h-8 text-center bg-background/50"
                    />
                    <Button size="sm" onClick={() => handleContribute(challenge.id)}>
                      Contribute
                    </Button>
                  </div>
                </div>

                {/* Top Contributors */}
                {contributions[challenge.id] && contributions[challenge.id].length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Top Contributors
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {contributions[challenge.id]
                        .sort((a, b) => b.contribution - a.contribution)
                        .slice(0, 5)
                        .map((c) => (
                          <Badge key={c.id} variant="secondary" className="text-xs">
                            {c.hunter_name}: {c.contribution}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Completed Challenges */}
            {completedChallenges.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  Completed ({completedChallenges.length})
                </h4>
                <div className="space-y-2">
                  {completedChallenges.slice(0, 3).map((challenge) => (
                    <div 
                      key={challenge.id}
                      className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-green-400" />
                        <span className="font-medium">{challenge.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-cyan-400">+{challenge.reward_xp} XP</span>
                        <span className="text-yellow-400">+{challenge.reward_gold}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Create Challenge Dialog */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="border-primary/30 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Create Guild Challenge
            </DialogTitle>
            <DialogDescription>
              Set a goal for your guild to work towards together.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Challenge Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Complete 100 Quests"
                className="mt-1 bg-background/50"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the challenge..."
                className="mt-1 bg-background/50"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Target</label>
                <Input
                  type="number"
                  min={1}
                  value={targetValue}
                  onChange={(e) => setTargetValue(parseInt(e.target.value) || 100)}
                  className="mt-1 bg-background/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Zap className="h-3 w-3 text-cyan-400" />
                  XP Reward
                </label>
                <Input
                  type="number"
                  min={0}
                  value={rewardXp}
                  onChange={(e) => setRewardXp(parseInt(e.target.value) || 0)}
                  className="mt-1 bg-background/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Coins className="h-3 w-3 text-yellow-400" />
                  Gold Reward
                </label>
                <Input
                  type="number"
                  min={0}
                  value={rewardGold}
                  onChange={(e) => setRewardGold(parseInt(e.target.value) || 0)}
                  className="mt-1 bg-background/50"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!title.trim()}>
              Create Challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default GuildChallengesPanel;
