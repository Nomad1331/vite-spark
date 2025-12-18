import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useGuilds, Guild, GuildMember } from '@/hooks/useGuilds';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Castle, Users, Crown, Shield, Swords, MessageSquare, 
  Plus, LogOut, Trash2, Send, Trophy, Zap, Mail,
  Globe, UserPlus, Star, Target, Eye, ChevronUp, ChevronDown, X,
  Clock, UserX, Sparkles, MoreVertical, ArrowRight, Lock
} from 'lucide-react';
import { HunterProfileModal } from '@/components/HunterProfileModal';
import { HunterAvatar } from '@/components/HunterAvatar';
import GuildChallengesPanel from '@/components/GuildChallengesPanel';
import { motion, AnimatePresence } from 'framer-motion';

const ROLE_COLORS: Record<string, string> = {
  guild_master: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  vice_master: 'bg-violet-500/20 text-violet-400 border-violet-500/50',
  elite: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  member: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
};

const ROLE_LABELS: Record<string, string> = {
  guild_master: 'Guild Master',
  vice_master: 'Vice Master',
  elite: 'Elite',
  member: 'Member',
};

const ROLE_ICONS: Record<string, string> = {
  guild_master: '👑',
  vice_master: '⚔️',
  elite: '⭐',
  member: '🛡️',
};

const ACCESS_ICONS: Record<string, React.ReactNode> = {
  public: <Globe className="h-4 w-4" />,
  invite_only: <Lock className="h-4 w-4" />,
};

// Power tier colors for guild gate styling
const getPowerTier = (power: number) => {
  if (power >= 10000) return { 
    tier: 'legendary', 
    color: 'from-yellow-500 to-amber-600', 
    glow: 'shadow-[0_0_30px_hsl(45_100%_50%/0.3)]', 
    borderColor: 'border-yellow-500/80',
    glowColor: 'hsl(45 100% 50% / 0.3)',
    label: 'Legendary'
  };
  if (power >= 5000) return { 
    tier: 'epic', 
    color: 'from-violet-500 to-purple-600', 
    glow: 'shadow-[0_0_25px_hsl(270_70%_60%/0.3)]', 
    borderColor: 'border-violet-500/80',
    glowColor: 'hsl(270 70% 60% / 0.3)',
    label: 'Epic'
  };
  if (power >= 2000) return { 
    tier: 'rare', 
    color: 'from-cyan-500 to-blue-600', 
    glow: 'shadow-[0_0_20px_hsl(186_100%_50%/0.3)]', 
    borderColor: 'border-cyan-500/80',
    glowColor: 'hsl(186 100% 50% / 0.3)',
    label: 'Rare'
  };
  if (power >= 500) return { 
    tier: 'uncommon', 
    color: 'from-emerald-500 to-green-600', 
    glow: 'shadow-[0_0_15px_hsl(160_70%_50%/0.2)]', 
    borderColor: 'border-emerald-500/80',
    glowColor: 'hsl(160 70% 50% / 0.2)',
    label: 'Uncommon'
  };
  return { 
    tier: 'common', 
    color: 'from-slate-500 to-gray-600', 
    glow: '', 
    borderColor: 'border-slate-600',
    glowColor: 'transparent',
    label: 'Common'
  };
};

interface SearchResult {
  user_id: string;
  hunter_name: string;
  avatar: string;
}

const Guilds = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    guilds,
    myGuild,
    myMembership,
    guildMembers,
    guildMessages,
    myInvites,
    sentInvites,
    loading,
    createGuild,
    joinGuild,
    leaveGuild,
    disbandGuild,
    sendMessage,
    acceptInvite,
    declineInvite,
    searchUsers,
    sendInvite,
    revokeInvite,
    promoteMember,
    demoteMember,
    kickMember,
  } = useGuilds();

  const [activeTab, setActiveTab] = useState<string>(myGuild ? 'my-guild' : 'browse');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [guildName, setGuildName] = useState('');
  const [guildDescription, setGuildDescription] = useState('');
  const [accessType, setAccessType] = useState<'public' | 'invite_only'>('public');
  const [messageInput, setMessageInput] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [selectedMember, setSelectedMember] = useState<GuildMember | null>(null);
  const [manageMemberModal, setManageMemberModal] = useState<GuildMember | null>(null);
  const [manageInvitesOpen, setManageInvitesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages only when user sends a new message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Update tab when guild changes
  useEffect(() => {
    if (myGuild && activeTab === 'browse') {
      setActiveTab('my-guild');
    }
  }, [myGuild]);

  const handleCreateGuild = async () => {
    if (!guildName.trim()) return;
    
    const success = await createGuild(guildName, guildDescription, accessType);
    if (success) {
      setCreateModalOpen(false);
      setGuildName('');
      setGuildDescription('');
      setAccessType('public');
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    
    const success = await sendMessage(messageInput);
    if (success) {
      setMessageInput('');
      setTimeout(() => scrollToBottom(), 100);
    }
  };

  // Search for users to invite
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const results = await searchUsers(query);
    setSearchResults(results);
    setSearching(false);
  };

  const handleInvite = async (inviteeId: string, inviteeName: string) => {
    const success = await sendInvite(inviteeId, inviteeName);
    if (success) {
      setSearchResults(prev => prev.filter(u => u.user_id !== inviteeId));
    }
  };

  const canInvite = myMembership && ['guild_master', 'vice_master', 'elite'].includes(myMembership.role);

  // Sort members by role hierarchy
  const sortedMembers = [...guildMembers].sort((a, b) => {
    const roleOrder = { guild_master: 0, vice_master: 1, elite: 2, member: 3 };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  if (!user) {
    return (
      <main className="md:pl-[70px] pt-16 pb-8 px-4 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <Card className="border-primary/30 bg-card/50 backdrop-blur-sm">
            <CardContent className="py-16 text-center">
              <Castle className="h-16 w-16 mx-auto mb-4 text-primary opacity-50" />
              <h2 className="text-2xl font-orbitron font-bold mb-2">Join the Hunt</h2>
              <p className="text-muted-foreground mb-6">
                Sign in to create or join guilds and battle alongside fellow hunters!
              </p>
              <Button onClick={() => navigate('/auth')} className="bg-primary hover:bg-primary/90">
                Sign In to Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="md:pl-[70px] pt-16 pb-8 px-4 min-h-screen relative overflow-hidden">
      {/* Atmospheric Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-cyan-500/10"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0.05, 0.1, 0.05],
            }}
            transition={{
              duration: 8 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(0_0%_0%/0.2)_100%)]" />
      </div>
      
      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        {/* Epic Header */}
        <motion.div 
          className="relative text-center py-8 md:py-12 overflow-hidden rounded-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-background rounded-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(186_100%_50%/0.2),transparent_50%)]" />
          
          {/* Animated beam effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -inset-full w-[200%] h-full opacity-20">
              <div className="absolute top-0 left-0 w-1/4 h-full bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent animate-beam" />
            </div>
          </div>
          
          {/* Decorative vertical lines */}
          <div className="absolute top-4 left-1/4 w-px h-16 bg-gradient-to-b from-cyan-500/50 to-transparent" />
          <div className="absolute top-4 right-1/4 w-px h-16 bg-gradient-to-b from-cyan-500/50 to-transparent" />
          
          <div className="relative">
            <div className="flex items-center justify-center gap-4 md:gap-8 mb-4">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="text-cyan-500 drop-shadow-[0_0_15px_hsl(186_100%_50%/0.8)]"
              >
                <Castle className="h-8 w-8 md:h-12 md:w-12" />
              </motion.div>
              
              <h1 className="text-3xl md:text-5xl font-bold font-cinzel tracking-wider">
                <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-600 bg-clip-text text-transparent drop-shadow-[0_0_20px_hsl(186_100%_50%/0.5)]">
                  GUILD HALL
                </span>
              </h1>
              
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                className="text-cyan-500 drop-shadow-[0_0_15px_hsl(186_100%_50%/0.8)]"
              >
                <Castle className="h-8 w-8 md:h-12 md:w-12" />
              </motion.div>
            </div>
            
            {/* Decorative Line with Sparkle */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-px w-16 md:w-32 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="h-5 w-5 text-cyan-500" />
              </motion.div>
              <div className="h-px w-16 md:w-32 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
            </div>
            
            <motion.p 
              className="text-cyan-300/70 text-sm md:text-base"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Unite with hunters · Conquer the gates together
            </motion.p>
          </div>
        </motion.div>

        {/* Invites Banner */}
        <AnimatePresence>
          {myInvites.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-yellow-500/10 shadow-[0_0_30px_hsl(45_100%_50%/0.2)]">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <Mail className="h-6 w-6 text-yellow-400" />
                    </motion.div>
                    <span className="font-cinzel font-semibold text-yellow-400">
                      {myInvites.length} Pending Guild Invite{myInvites.length > 1 ? 's' : ''}!
                    </span>
                  </div>
                  <div className="space-y-2">
                    {myInvites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between bg-background/30 rounded-lg p-3 border border-yellow-500/20">
                        <div className="flex items-center gap-3">
                          <Castle className="h-5 w-5 text-yellow-400" />
                          <div>
                            <span className="font-medium text-yellow-300">{invite.guild_name}</span>
                            <span className="text-muted-foreground text-sm ml-2">
                              invited by {invite.inviter_name}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => acceptInvite(invite.id, invite.guild_id)}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/50 text-destructive hover:bg-destructive/10"
                            onClick={() => declineInvite(invite.id)}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 bg-card/80 border border-primary/30 p-1.5 backdrop-blur-sm">
              <TabsTrigger 
                value="browse" 
                className="relative flex items-center gap-2 font-cinzel transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/30 data-[state=active]:to-cyan-500/20 data-[state=active]:text-primary hover:bg-primary/10 hover:shadow-[0_0_10px_hsl(var(--primary)/0.2)] data-[state=active]:shadow-[0_0_15px_hsl(var(--primary)/0.3)] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:w-3/4 data-[state=active]:after:h-[3px] data-[state=active]:after:bg-cyan-500 data-[state=active]:after:rounded-full data-[state=active]:after:shadow-[0_0_10px_hsl(186_100%_50%/0.8)]"
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Browse Gates</span>
              </TabsTrigger>
              <TabsTrigger 
                value="my-guild" 
                className="relative flex items-center gap-2 font-cinzel transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/30 data-[state=active]:to-cyan-500/20 data-[state=active]:text-primary hover:bg-primary/10 hover:shadow-[0_0_10px_hsl(var(--primary)/0.2)] data-[state=active]:shadow-[0_0_15px_hsl(var(--primary)/0.3)] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:w-3/4 data-[state=active]:after:h-[3px] data-[state=active]:after:bg-cyan-500 data-[state=active]:after:rounded-full data-[state=active]:after:shadow-[0_0_10px_hsl(186_100%_50%/0.8)]"
              >
                <Castle className="h-4 w-4" />
                <span className="hidden sm:inline">My Guild</span>
              </TabsTrigger>
              <TabsTrigger 
                value="rankings" 
                className="relative flex items-center gap-2 font-cinzel transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/30 data-[state=active]:to-cyan-500/20 data-[state=active]:text-primary hover:bg-primary/10 hover:shadow-[0_0_10px_hsl(var(--primary)/0.2)] data-[state=active]:shadow-[0_0_15px_hsl(var(--primary)/0.3)] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-1/2 data-[state=active]:after:-translate-x-1/2 data-[state=active]:after:w-3/4 data-[state=active]:after:h-[3px] data-[state=active]:after:bg-cyan-500 data-[state=active]:after:rounded-full data-[state=active]:after:shadow-[0_0_10px_hsl(186_100%_50%/0.8)]"
              >
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Rankings</span>
              </TabsTrigger>
            </TabsList>

            {/* Browse Guilds */}
            <TabsContent value="browse" className="mt-6 space-y-4">
              <motion.div 
                className="flex justify-between items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-xl md:text-2xl font-cinzel text-primary flex items-center gap-3">
                  <Target className="h-5 w-5 md:h-6 md:w-6" />
                  Available Guild Gates
                </h2>
                {!myGuild && (
                  <Button 
                    onClick={() => setCreateModalOpen(true)} 
                    className="bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 shadow-[0_0_20px_hsl(var(--primary)/0.4)] active:scale-95 transition-all"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Establish Guild</span>
                    <span className="sm:hidden">Create</span>
                  </Button>
                )}
              </motion.div>

              {loading ? (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-64" />
                  ))}
                </div>
              ) : guilds.length === 0 ? (
                <Card className="border-primary/20 bg-gradient-to-br from-card/80 to-background">
                  <CardContent className="py-16 text-center">
                    <Castle className="h-20 w-20 mx-auto mb-4 opacity-30 text-primary" />
                    <p className="text-muted-foreground text-lg">No guilds discovered yet. Be the first to establish one!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {guilds.map((guild, index) => (
                    <GuildGateCard
                      key={guild.id}
                      guild={guild}
                      onJoin={() => joinGuild(guild.id)}
                      isInGuild={!!myGuild}
                      isMyGuild={myGuild?.id === guild.id}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* My Guild */}
            <TabsContent value="my-guild" className="mt-6 space-y-6">
              {!myGuild ? (
                <Card className="border-primary/20 bg-gradient-to-br from-card/80 to-background">
                  <CardContent className="py-16 text-center">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Castle className="h-24 w-24 mx-auto mb-4 text-primary/30" />
                    </motion.div>
                    <h3 className="text-2xl font-cinzel font-semibold mb-2">No Guild Yet</h3>
                    <p className="text-muted-foreground mb-6 text-lg">
                      Join an existing guild or establish your own!
                    </p>
                    <Button onClick={() => setActiveTab('browse')} className="bg-primary hover:bg-primary/90">
                      Browse Guild Gates
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Guild Banner */}
                  <GuildBanner 
                    guild={myGuild} 
                    membership={myMembership}
                    memberCount={guildMembers.length}
                    canInvite={canInvite}
                    onInvite={() => setInviteModalOpen(true)}
                    onManageInvites={() => setManageInvitesOpen(true)}
                    sentInvitesCount={sentInvites.length}
                    onLeave={() => setConfirmLeave(true)}
                    onDisband={() => setConfirmDisband(true)}
                  />

                  {/* Members and Chat */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Party Members Panel */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Card className="border-primary/30 bg-gradient-to-br from-slate-800/30 to-slate-900/50 overflow-hidden rounded-xl">
                        <CardHeader className="border-b border-primary/20 bg-primary/5 p-4 md:p-6">
                          <CardTitle className="text-lg md:text-2xl font-cinzel flex items-center gap-3 text-primary">
                            <Swords className="h-5 w-5" />
                            Party Members
                            <Badge variant="outline" className="ml-auto border-primary/50 text-primary">
                              {guildMembers.length}/{myGuild.max_members}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <ScrollArea className="h-[350px]">
                            <div className="p-4 md:p-6 space-y-2">
                              {sortedMembers.map((member) => (
                                <MemberCard 
                                  key={member.id}
                                  member={member}
                                  isGuildMaster={myMembership?.role === 'guild_master'}
                                  currentUserId={user.id}
                                  onViewProfile={() => setSelectedMember(member)}
                                  onManage={() => setManageMemberModal(member)}
                                />
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* System Chat Panel */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Card className="border-2 border-violet-500/50 bg-gradient-to-br from-violet-950/50 to-slate-900 overflow-hidden rounded-xl shadow-[0_0_25px_hsl(270_70%_60%/0.25)]">
                        <CardHeader className="border-b border-violet-500/20 bg-violet-500/5 p-4 md:p-6">
                          <CardTitle className="text-lg md:text-2xl font-cinzel flex items-center gap-3 text-violet-400">
                            <Sparkles className="h-5 w-5" />
                            System Messages
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col h-[400px] p-0">
                          <ScrollArea className="flex-1 p-4">
                            <div className="space-y-4">
                              {guildMessages.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                  <motion.div
                                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="relative inline-block"
                                  >
                                    <MessageSquare className="h-16 w-16 mx-auto mb-3 text-violet-500/50" />
                                    <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl" />
                                  </motion.div>
                                  <p className="text-violet-300/70">No messages yet. Start the conversation!</p>
                                </div>
                              ) : (
                                guildMessages.map((msg) => {
                                  const isMe = msg.user_id === user.id;
                                  return (
                                    <motion.div
                                      key={msg.id}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className={`p-3 rounded-lg border ${
                                        isMe
                                          ? 'bg-primary/10 border-primary/30 ml-4 md:ml-8'
                                          : 'bg-slate-800/30 border-violet-500/30 mr-4 md:mr-8'
                                      } hover:shadow-[0_0_10px_hsl(270_70%_60%/0.2)] transition-shadow`}
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <Sparkles className={`h-4 w-4 ${isMe ? 'text-primary' : 'text-violet-400'}`} />
                                        <span className={`text-xs font-semibold ${isMe ? 'text-primary' : 'text-violet-400'}`}>
                                          {msg.sender_name}
                                        </span>
                                        <span className="text-xs text-cyan-400/60 ml-auto">
                                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <p className="text-sm text-slate-200 leading-relaxed">{msg.message}</p>
                                    </motion.div>
                                  );
                                })
                              )}
                              <div ref={messagesEndRef} />
                            </div>
                          </ScrollArea>
                          
                          <div className="flex gap-2 p-4 border-t border-violet-500/20 bg-violet-500/5">
                            <div className="relative flex-1">
                              <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
                              <Input
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                placeholder="[SYSTEM] Enter message..."
                                className="pl-10 bg-slate-800 border-violet-500/30 focus:border-violet-500 rounded-lg"
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                              />
                            </div>
                            <Button 
                              onClick={handleSendMessage} 
                              size="icon"
                              className="bg-violet-600 hover:bg-violet-500 rounded-lg hover:shadow-[0_0_15px_hsl(270_70%_60%/0.5)] transition-all hover:scale-105"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>

                  {/* Guild Challenges */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <GuildChallengesPanel guildId={myGuild.id} isLeader={myMembership?.role === 'guild_master' || myMembership?.role === 'vice_master'} />
                  </motion.div>
                </>
              )}
            </TabsContent>

            {/* Guild Rankings */}
            <TabsContent value="rankings" className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-yellow-500/30 bg-gradient-to-br from-slate-900/50 to-background overflow-hidden">
                  <CardHeader className="border-b border-yellow-500/20 bg-yellow-500/5 p-4 md:p-8">
                    <CardTitle className="text-2xl md:text-3xl font-cinzel flex items-center gap-3 text-yellow-400">
                      <Trophy className="h-6 w-6 md:h-8 md:w-8" />
                      Guild Rankings
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Compete for glory and dominance
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 md:p-8">
                    {loading ? (
                      <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                          <Skeleton key={i} className="h-20" />
                        ))}
                      </div>
                    ) : (
                      <>
                        {/* Top 3 Podium */}
                        {guilds.length >= 3 && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {/* Second Place */}
                            <div className="order-2 md:order-1">
                              <PodiumCard guild={guilds[1]} rank={2} isMyGuild={myGuild?.id === guilds[1]?.id} topPower={guilds[0]?.total_power} />
                            </div>
                            {/* First Place */}
                            <div className="order-1 md:order-2">
                              <PodiumCard guild={guilds[0]} rank={1} isMyGuild={myGuild?.id === guilds[0]?.id} topPower={guilds[0]?.total_power} />
                            </div>
                            {/* Third Place */}
                            <div className="order-3">
                              <PodiumCard guild={guilds[2]} rank={3} isMyGuild={myGuild?.id === guilds[2]?.id} topPower={guilds[0]?.total_power} />
                            </div>
                          </div>
                        )}
                        
                        {/* Remaining Rankings */}
                        <div className="space-y-2">
                          {guilds.slice(3, 20).map((guild, index) => (
                            <RankingEntry 
                              key={guild.id} 
                              guild={guild} 
                              rank={index + 4} 
                              isMyGuild={myGuild?.id === guild.id}
                              topPower={guilds[0]?.total_power}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Create Guild Modal */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogContent className="border-2 border-cyan-500/50 bg-gradient-to-br from-slate-900 to-slate-950 backdrop-blur-sm overflow-hidden max-w-2xl shadow-[0_0_30px_hsl(186_100%_50%/0.2)]">
            {/* Decorative corners */}
            <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-cyan-500 animate-corner-draw" />
            <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-cyan-500 animate-corner-draw" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-cyan-500 animate-corner-draw" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-cyan-500 animate-corner-draw" />
            
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 font-cinzel text-2xl md:text-3xl">
                <Swords className="h-6 w-6 md:h-8 md:w-8 text-cyan-400" />
                <span className="bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">
                  Forge Your Guild
                </span>
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Unite hunters under your banner
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-cyan-400 flex items-center gap-2">
                  <Castle className="h-4 w-4" />
                  Guild Name
                </label>
                <Input
                  value={guildName}
                  onChange={(e) => setGuildName(e.target.value)}
                  placeholder="Enter guild name..."
                  className="bg-slate-800 border-slate-700 focus:border-cyan-500 rounded-lg focus:shadow-[0_0_10px_hsl(186_100%_50%/0.3)]"
                  maxLength={30}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-cyan-400">Description</label>
                <Textarea
                  value={guildDescription}
                  onChange={(e) => setGuildDescription(e.target.value)}
                  placeholder="Describe your guild..."
                  className="bg-slate-800 border-slate-700 focus:border-cyan-500 resize-none rounded-lg"
                  rows={3}
                  maxLength={200}
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-medium text-cyan-400">Access Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setAccessType('public')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      accessType === 'public'
                        ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_hsl(186_100%_50%/0.3)]'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Globe className={`h-8 w-8 mx-auto mb-2 ${accessType === 'public' ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <p className={`font-medium ${accessType === 'public' ? 'text-cyan-400' : 'text-slate-400'}`}>🌍 Public</p>
                    <p className="text-xs text-slate-500 mt-1">Anyone can join</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessType('invite_only')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      accessType === 'invite_only'
                        ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_hsl(186_100%_50%/0.3)]'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Lock className={`h-8 w-8 mx-auto mb-2 ${accessType === 'invite_only' ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <p className={`font-medium ${accessType === 'invite_only' ? 'text-cyan-400' : 'text-slate-400'}`}>🔒 Invite Only</p>
                    <p className="text-xs text-slate-500 mt-1">Requires invitation</p>
                  </button>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => setCreateModalOpen(false)}
                className="border-slate-700 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateGuild} 
                disabled={!guildName.trim()}
                className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 shadow-[0_0_15px_hsl(186_100%_50%/0.3)] disabled:opacity-50"
              >
                <Castle className="h-4 w-4 mr-2" />
                {!guildName.trim() ? 'Enter Name...' : 'Establish Guild'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Leave Modal */}
        <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
          <DialogContent className="border-destructive/30">
            <DialogHeader>
              <DialogTitle>Leave Guild?</DialogTitle>
              <DialogDescription>
                Are you sure you want to leave {myGuild?.name}? You'll lose your contribution progress.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmLeave(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  leaveGuild();
                  setConfirmLeave(false);
                }}
              >
                Leave Guild
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Disband Modal */}
        <Dialog open={confirmDisband} onOpenChange={setConfirmDisband}>
          <DialogContent className="border-destructive/30">
            <DialogHeader>
              <DialogTitle>Disband Guild?</DialogTitle>
              <DialogDescription>
                This will permanently delete {myGuild?.name} and remove all members. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDisband(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  disbandGuild();
                  setConfirmDisband(false);
                }}
              >
                Disband Guild
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hunter Profile Modal */}
        <HunterProfileModal
          open={!!selectedMember}
          onOpenChange={(open) => !open && setSelectedMember(null)}
          userId={selectedMember?.user_id || ''}
          hunterName={selectedMember?.hunter_name || ''}
        />

        {/* Invite Hunter Modal */}
        <Dialog open={inviteModalOpen} onOpenChange={(open) => {
          setInviteModalOpen(open);
          if (!open) {
            setSearchQuery('');
            setSearchResults([]);
          }
        }}>
          <DialogContent className="border-primary/30 bg-card/95 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-cinzel">
                <UserPlus className="h-5 w-5 text-primary" />
                Invite Hunter to Guild
              </DialogTitle>
              <DialogDescription>
                Search for hunters by name to invite them to {myGuild?.name}.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search Hunter Name</label>
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Enter hunter name..."
                  className="bg-background/50"
                />
              </div>
              
              <ScrollArea className="h-[250px] pr-4">
                {searching ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-14" />
                    ))}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery.length < 2 
                      ? 'Type at least 2 characters to search' 
                      : 'No hunters found'
                    }
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((result) => (
                      <div
                        key={result.user_id}
                        className="flex items-center justify-between p-3 rounded-lg bg-background/30 hover:bg-background/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <HunterAvatar 
                            avatar={result.avatar} 
                            hunterName={result.hunter_name} 
                            size="sm"
                          />
                          <span className="font-medium">{result.hunter_name}</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleInvite(result.user_id, result.hunter_name)}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Invite
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Member Modal */}
        <Dialog open={!!manageMemberModal} onOpenChange={() => setManageMemberModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Manage Member
              </DialogTitle>
              <DialogDescription>
                Manage {manageMemberModal?.hunter_name}'s role in the guild.
              </DialogDescription>
            </DialogHeader>
            
            {manageMemberModal && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-background/30">
                  <HunterAvatar 
                    avatar={manageMemberModal.avatar} 
                    hunterName={manageMemberModal.hunter_name || 'Unknown'} 
                    size="md"
                  />
                  <div>
                    <p className="font-semibold">{manageMemberModal.hunter_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Lv. {manageMemberModal.level} • {manageMemberModal.power} PWR
                    </p>
                    <Badge variant="outline" className={`mt-1 ${ROLE_COLORS[manageMemberModal.role]}`}>
                      {ROLE_LABELS[manageMemberModal.role]}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Actions</p>
                  <div className="grid gap-2">
                    {manageMemberModal.role !== 'vice_master' && (
                      <Button
                        variant="outline"
                        className="w-full justify-start border-green-500/50 text-green-400 hover:bg-green-500/10"
                        onClick={async () => {
                          await promoteMember(manageMemberModal.id, manageMemberModal.role);
                          setManageMemberModal(null);
                        }}
                      >
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Promote to {manageMemberModal.role === 'member' ? 'Elite' : 'Vice Master'}
                      </Button>
                    )}
                    {manageMemberModal.role !== 'member' && (
                      <Button
                        variant="outline"
                        className="w-full justify-start border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                        onClick={async () => {
                          await demoteMember(manageMemberModal.id, manageMemberModal.role);
                          setManageMemberModal(null);
                        }}
                      >
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Demote to {manageMemberModal.role === 'vice_master' ? 'Elite' : 'Member'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-full justify-start border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        await kickMember(manageMemberModal.id, manageMemberModal.user_id);
                        setManageMemberModal(null);
                      }}
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Kick from Guild
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setManageMemberModal(null)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Invites Modal */}
        <Dialog open={manageInvitesOpen} onOpenChange={setManageInvitesOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-yellow-400" />
                Pending Invites
              </DialogTitle>
              <DialogDescription>
                Manage pending invites for {myGuild?.name}. Invites expire after 48 hours.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {sentInvites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No pending invites</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {sentInvites.map((invite) => {
                      const expiresAt = new Date(invite.expires_at);
                      const hoursLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));
                      
                      return (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-background/30"
                        >
                          <div>
                            <p className="font-medium">{invite.invitee_name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires in {hoursLeft}h
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/50 text-destructive hover:bg-destructive/10"
                            onClick={() => revokeInvite(invite.id)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Revoke
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setManageInvitesOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
};

// Guild Gate Card - Solo Leveling style
const GuildGateCard = ({
  guild,
  onJoin,
  isInGuild,
  isMyGuild,
  index,
}: {
  guild: Guild;
  onJoin: () => void;
  isInGuild: boolean;
  isMyGuild: boolean;
  index: number;
}) => {
  const powerTier = getPowerTier(guild.total_power);
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className={`relative overflow-hidden border-2 ${powerTier.borderColor} ${powerTier.glow} bg-slate-800/50 backdrop-blur-sm rounded-xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ${
        isMyGuild ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      } ${powerTier.tier === 'legendary' ? 'animate-glow-pulse' : ''}`}
      style={{ '--glow-color': powerTier.glowColor } as React.CSSProperties}
      >
        {/* Corner cuts effect */}
        <div className="absolute top-0 left-0 w-6 h-6 bg-gradient-to-br from-background to-transparent" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
        <div className="absolute top-0 right-0 w-6 h-6 bg-gradient-to-bl from-background to-transparent" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }} />
        <div className="absolute bottom-0 left-0 w-6 h-6 bg-gradient-to-tr from-background to-transparent" style={{ clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }} />
        <div className="absolute bottom-0 right-0 w-6 h-6 bg-gradient-to-tl from-background to-transparent" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
        
        {/* Power tier indicator glow */}
        <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${powerTier.color}`} />
        
        <CardContent className="relative p-6">
          {/* Top section: Emblem + Name */}
          <div className="flex items-start gap-4 mb-4">
            <motion.div 
              className={`p-3 rounded-lg bg-gradient-to-br ${powerTier.color} flex-shrink-0`}
              animate={isHovered ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Castle className="h-10 w-10 md:h-14 md:w-14 text-white" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-cinzel font-bold text-lg truncate">{guild.name}</h3>
                {isMyGuild && (
                  <Badge className="bg-primary/20 text-primary border-primary/50 text-xs flex-shrink-0">
                    Your Guild
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-cyan-400" />
                <span>{guild.member_count}/{guild.max_members}</span>
                {ACCESS_ICONS[guild.access_type]}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {guild.description || 'No description'}
              </p>
            </div>
          </div>
          
          {/* Power Display */}
          <div className="mb-4 p-3 rounded-lg bg-background/50 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-cyan-400" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Power</span>
              </div>
              <motion.span 
                className={`font-cinzel font-bold text-xl bg-gradient-to-r ${powerTier.color} bg-clip-text text-transparent`}
                animate={isHovered ? { scale: [1, 1.05, 1] } : {}}
              >
                {guild.total_power.toLocaleString()}
              </motion.span>
            </div>
          </div>
          
          {/* Guild Master */}
          <div className="flex items-center gap-2 mb-4 text-sm">
            <Crown className="h-4 w-4 text-yellow-400" />
            <span className="text-muted-foreground">{guild.master_name}</span>
          </div>
          
          {/* Action */}
          <div className="flex justify-end">
            {!isInGuild && guild.access_type === 'public' && (
              <Button 
                size="sm" 
                onClick={onJoin}
                className={`bg-gradient-to-r ${powerTier.color} hover:opacity-90 active:scale-95 transition-all group`}
              >
                <Swords className="h-4 w-4 mr-1" />
                Join Guild
                <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Button>
            )}
            {guild.access_type === 'invite_only' && !isMyGuild && (
              <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                <Lock className="h-3 w-3 mr-1" />
                Invite Only
              </Badge>
            )}
            {isMyGuild && (
              <Badge className={`bg-gradient-to-r ${powerTier.color} text-white`}>
                <Eye className="h-3 w-3 mr-1" />
                View Guild
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Guild Banner Component
const GuildBanner = ({
  guild,
  membership,
  memberCount,
  canInvite,
  onInvite,
  onManageInvites,
  sentInvitesCount,
  onLeave,
  onDisband,
}: {
  guild: Guild;
  membership: any;
  memberCount: number;
  canInvite: boolean;
  onInvite: () => void;
  onManageInvites: () => void;
  sentInvitesCount: number;
  onLeave: () => void;
  onDisband: () => void;
}) => {
  const powerTier = getPowerTier(guild.total_power);
  const [displayPower, setDisplayPower] = useState(0);
  
  // Number counting animation
  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = guild.total_power / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= guild.total_power) {
        setDisplayPower(guild.total_power);
        clearInterval(timer);
      } else {
        setDisplayPower(Math.floor(current));
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [guild.total_power]);
  
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'guild_master':
        return 'bg-gradient-to-r from-yellow-600 to-amber-500 text-white animate-glow-pulse-gold';
      case 'vice_master':
        return 'bg-gradient-to-r from-violet-600 to-purple-500 text-white';
      case 'elite':
        return 'bg-gradient-to-r from-cyan-600 to-blue-500 text-white';
      default:
        return 'bg-slate-700 text-slate-200';
    }
  };
  
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'guild_master': return <Crown className="h-4 w-4" />;
      case 'vice_master': return <Shield className="h-4 w-4" />;
      case 'elite': return <Star className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className={`relative overflow-hidden border-2 ${powerTier.borderColor} ${powerTier.glow} min-h-[200px] md:min-h-[300px] rounded-2xl`}>
        {/* Background gradient - enhanced with teal */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900" />
        <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${powerTier.color}`} />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80" />
        
        {/* L-shaped Corner decorations */}
        <div className="absolute top-0 left-0 w-12 h-12 md:w-20 md:h-20 border-l-2 border-t-2 border-cyan-500 animate-corner-draw shadow-[0_0_10px_hsl(186_100%_50%/0.5)]" />
        <div className="absolute bottom-0 right-0 w-12 h-12 md:w-20 md:h-20 border-r-2 border-b-2 border-cyan-500 animate-corner-draw shadow-[0_0_10px_hsl(186_100%_50%/0.5)]" />
        
        <CardContent className="relative py-6 md:py-8 px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Left: Guild Emblem with animated glow */}
            <div className="flex justify-center md:justify-start">
              <motion.div 
                className={`relative p-4 md:p-6 rounded-full bg-gradient-to-br ${powerTier.color} bg-opacity-20 border-2 md:border-3 ${powerTier.borderColor}`}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* Pulsing cyan glow effect */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-cyan-500/30 blur-xl"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Castle className="h-16 w-16 md:h-24 md:w-24 text-white drop-shadow-lg relative z-10" />
                </motion.div>
              </motion.div>
            </div>
            
            {/* Center: Guild Info */}
            <div className="text-center">
              <h2 className={`text-2xl md:text-4xl font-cinzel font-bold text-white drop-shadow-[0_0_10px_hsl(0_0%_100%/0.3)] mb-3`}>
                {guild.name}
              </h2>
              
              <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
                {/* Bigger, more prominent power stat */}
                <motion.div 
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/50 border border-cyan-500/30 shadow-[0_0_15px_hsl(186_100%_50%/0.2)]"
                  whileHover={{ scale: 1.05 }}
                >
                  <Zap className="h-6 w-6 text-cyan-400" />
                  <span className="font-cinzel text-2xl md:text-3xl font-bold text-cyan-400">
                    {displayPower.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">POWER</span>
                </motion.div>
                
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/50 border border-cyan-500/20">
                  <Users className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-medium">{memberCount}/{guild.max_members}</span>
                  <span className="text-xs text-muted-foreground">Members</span>
                </div>
              </div>
              
              <Badge className={`${guild.access_type === 'public' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-violet-500/20 text-violet-400 border-violet-500/50'} rounded-full px-3 py-1`}>
                {guild.access_type === 'public' ? '🌍 Public' : '🔒 Invite Only'}
              </Badge>
            </div>
            
            {/* Right: Role Badge + Actions */}
            <div className="flex flex-col items-center md:items-end gap-3">
              {/* Role Badge */}
              <div className={`px-4 md:px-6 py-2 md:py-3 rounded-lg ${getRoleBadgeStyle(membership?.role || 'member')} flex items-center gap-2`}>
                {getRoleIcon(membership?.role || 'member')}
                <span className="font-bold text-base md:text-lg">{ROLE_LABELS[membership?.role || 'member']}</span>
              </div>
              
              {/* Actions */}
              <div className="flex flex-wrap justify-center md:justify-end gap-2">
                {canInvite && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary/50 text-primary hover:bg-primary/10"
                      onClick={onInvite}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Invite</span>
                    </Button>
                    {sentInvitesCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                        onClick={onManageInvites}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        ({sentInvitesCount})
                      </Button>
                    )}
                  </>
                )}
                {membership?.role !== 'guild_master' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={onLeave}
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Leave</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={onDisband}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Disband</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Member Card Component
const MemberCard = ({
  member,
  isGuildMaster,
  currentUserId,
  onViewProfile,
  onManage,
}: {
  member: GuildMember;
  isGuildMaster: boolean;
  currentUserId: string;
  onViewProfile: () => void;
  onManage: () => void;
}) => {
  const roleConfig: Record<string, { color: string; borderColor: string; glow?: string }> = {
    guild_master: { color: 'text-yellow-400', borderColor: 'border-yellow-500', glow: 'shadow-[0_0_15px_hsl(45_100%_50%/0.4)]' },
    vice_master: { color: 'text-violet-400', borderColor: 'border-violet-500' },
    elite: { color: 'text-cyan-400', borderColor: 'border-cyan-500' },
    member: { color: 'text-slate-400', borderColor: 'border-slate-600' },
  };
  
  const config = roleConfig[member.role] || roleConfig.member;
  const isGuildMasterMember = member.role === 'guild_master';
  
  return (
    <motion.div
      className={`flex items-center justify-between p-3 md:p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-all group border ${isGuildMasterMember ? 'border-yellow-500/50 ' + config.glow : 'border-transparent hover:border-primary/20'}`}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div 
        className="flex items-center gap-3 flex-1 cursor-pointer"
        onClick={onViewProfile}
      >
        <div className={`relative rounded-full border-2 ${config.borderColor} ${isGuildMasterMember ? 'border-2' : 'border'}`}>
          <HunterAvatar 
            avatar={member.avatar} 
            hunterName={member.hunter_name || 'Unknown'} 
            size="sm"
          />
          {/* Online status dot */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate text-white">{member.hunter_name}</p>
            {member.user_id === currentUserId && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">You</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Lv. {member.level}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-cyan-400">
              <Zap className="h-3 w-3" />
              {member.power}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isGuildMaster && member.role !== 'guild_master' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20"
            onClick={(e) => { e.stopPropagation(); onManage(); }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        )}
        <Badge 
          variant="outline" 
          className={`${ROLE_COLORS[member.role]} flex items-center gap-1 rounded-full px-2 md:px-3 py-1`}
        >
          <span>{ROLE_ICONS[member.role]}</span>
          <span className="hidden sm:inline text-xs">{ROLE_LABELS[member.role]}</span>
        </Badge>
      </div>
    </motion.div>
  );
};

// Podium Card for Top 3
const PodiumCard = ({
  guild,
  rank,
  isMyGuild,
  topPower,
}: {
  guild: Guild;
  rank: number;
  isMyGuild: boolean;
  topPower: number;
}) => {
  if (!guild) return null;
  
  const powerTier = getPowerTier(guild.total_power);
  
  const getRankConfig = () => {
    switch (rank) {
      case 1:
        return {
          height: 'h-auto md:h-48',
          bg: 'from-yellow-500/20 to-yellow-600/10',
          border: 'border-yellow-500',
          glow: 'shadow-[0_0_40px_hsl(45_100%_50%/0.4)]',
          icon: '👑',
          color: 'text-yellow-400',
        };
      case 2:
        return {
          height: 'h-auto md:h-40',
          bg: 'from-slate-400/20 to-slate-500/10',
          border: 'border-slate-400',
          glow: 'shadow-[0_0_30px_hsl(220_10%_60%/0.3)]',
          icon: '🥈',
          color: 'text-slate-300',
        };
      case 3:
        return {
          height: 'h-auto md:h-36',
          bg: 'from-amber-700/20 to-amber-800/10',
          border: 'border-amber-700',
          glow: 'shadow-[0_0_25px_hsl(25_80%_40%/0.3)]',
          icon: '🥉',
          color: 'text-amber-500',
        };
      default:
        return {
          height: 'h-auto',
          bg: 'from-slate-700/20 to-slate-800/10',
          border: 'border-slate-600',
          glow: '',
          icon: '',
          color: 'text-slate-400',
        };
    }
  };
  
  const config = getRankConfig();
  const powerPercentage = topPower > 0 ? Math.round((guild.total_power / topPower) * 100) : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: rank * 0.15, type: "spring" }}
      className={`${config.height}`}
    >
      <Card className={`relative overflow-hidden border-3 ${config.border} ${config.glow} bg-gradient-to-b ${config.bg} h-full ${rank === 1 ? 'animate-glow-pulse' : ''} ${isMyGuild ? 'ring-2 ring-primary' : ''}`}>
        {/* Rank badge */}
        <div className="absolute top-2 right-2 md:top-3 md:right-3">
          <motion.span 
            className="text-2xl md:text-3xl"
            animate={rank === 1 ? { rotate: [0, 5, -5, 0] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {config.icon}
          </motion.span>
        </div>
        
        <CardContent className="p-4 md:p-6 text-center flex flex-col items-center justify-center h-full">
          {/* Guild Emblem */}
          <motion.div 
            className={`p-3 md:p-4 rounded-full bg-gradient-to-br ${powerTier.color} border-2 ${config.border} mb-3`}
            animate={rank === 1 ? { y: [0, -5, 0] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Castle className="h-10 w-10 md:h-16 md:w-16 text-white" />
          </motion.div>
          
          {/* Guild Name */}
          <h3 className={`font-cinzel font-bold text-lg md:text-2xl ${config.color} mb-2`}>
            {guild.name}
          </h3>
          
          {/* Power */}
          <div className={`font-cinzel font-bold text-lg md:text-xl ${config.color} flex items-center gap-1`}>
            <Zap className="h-4 w-4 md:h-5 md:w-5" />
            {guild.total_power.toLocaleString()}
          </div>
          
          {/* Power comparison bar (not for #1) */}
          {rank !== 1 && (
            <div className="w-full mt-3">
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full bg-gradient-to-r ${powerTier.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${powerPercentage}%` }}
                  transition={{ delay: 0.5, duration: 1 }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{powerPercentage}% of #1</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Ranking Entry Component
const RankingEntry = ({
  guild,
  rank,
  isMyGuild,
  topPower,
}: {
  guild: Guild;
  rank: number;
  isMyGuild: boolean;
  topPower: number;
}) => {
  const powerTier = getPowerTier(guild.total_power);
  const powerPercentage = topPower > 0 ? Math.round((guild.total_power / topPower) * 100) : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (rank - 3) * 0.05 }}
      className={`flex items-center justify-between p-3 md:p-4 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-all border-l-4 ${powerTier.borderColor} ${isMyGuild ? 'ring-2 ring-inset ring-primary' : ''}`}
    >
      <div className="flex items-center gap-3 md:gap-4">
        <span className="font-cinzel font-bold w-8 md:w-10 text-base md:text-lg text-slate-500">
          #{rank}
        </span>
        <div className={`p-1.5 md:p-2 rounded-lg bg-gradient-to-br ${powerTier.color}`}>
          <Castle className="h-4 w-4 md:h-6 md:w-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-cinzel font-semibold text-sm md:text-base">{guild.name}</p>
            {isMyGuild && (
              <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                Your Guild
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {guild.member_count} members
          </p>
          {/* Power comparison bar */}
          <div className="w-24 md:w-32 mt-1">
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${powerTier.color}`}
                style={{ width: `${powerPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-cinzel font-bold text-base md:text-lg bg-gradient-to-r ${powerTier.color} bg-clip-text text-transparent`}>
          {guild.total_power.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">Power</p>
      </div>
    </motion.div>
  );
};

export default Guilds;
