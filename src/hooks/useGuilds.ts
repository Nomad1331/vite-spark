import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Guild {
  id: string;
  name: string;
  description: string | null;
  emblem: string;
  access_type: 'public' | 'private' | 'invite_only';
  max_members: number;
  master_id: string;
  total_power: number;
  weekly_xp: number;
  created_at: string;
  member_count?: number;
  master_name?: string;
}

export interface GuildMember {
  id: string;
  guild_id: string;
  user_id: string;
  role: 'guild_master' | 'vice_master' | 'elite' | 'member';
  joined_at: string;
  contribution_xp: number;
  hunter_name?: string;
  avatar?: string;
  level?: number;
  power?: number;
}

export interface GuildMessage {
  id: string;
  guild_id: string;
  user_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
}

export interface GuildInvite {
  id: string;
  guild_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  expires_at: string;
  guild_name?: string;
  inviter_name?: string;
  invitee_name?: string;
}

export const useGuilds = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [myGuild, setMyGuild] = useState<Guild | null>(null);
  const [myMembership, setMyMembership] = useState<GuildMember | null>(null);
  const [guildMembers, setGuildMembers] = useState<GuildMember[]>([]);
  const [guildMessages, setGuildMessages] = useState<GuildMessage[]>([]);
  const [myInvites, setMyInvites] = useState<GuildInvite[]>([]);
  const [sentInvites, setSentInvites] = useState<GuildInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all public guilds
  const fetchGuilds = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('guilds')
        .select('*')
        .order('total_power', { ascending: false });

      if (error) throw error;

      // Get member counts for each guild
      const guildsWithCounts = await Promise.all(
        (data || []).map(async (guild) => {
          const { count } = await supabase
            .from('guild_members')
            .select('*', { count: 'exact', head: true })
            .eq('guild_id', guild.id);

          // Get master name
          const { data: profile } = await supabase
            .from('profiles')
            .select('hunter_name')
            .eq('user_id', guild.master_id)
            .maybeSingle();

          return {
            ...guild,
            member_count: count || 0,
            master_name: profile?.hunter_name || 'Unknown',
          } as Guild;
        })
      );

      setGuilds(guildsWithCounts);
    } catch (error: any) {
      console.error('Error fetching guilds:', error);
    }
  }, []);

  // Fetch user's guild membership
  const fetchMyGuild = useCallback(async () => {
    if (!user) {
      setMyGuild(null);
      setMyMembership(null);
      return;
    }

    try {
      const { data: membership, error: memberError } = await supabase
        .from('guild_members')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError) throw memberError;

      if (membership) {
        setMyMembership(membership as GuildMember);

        const { data: guild, error: guildError } = await supabase
          .from('guilds')
          .select('*')
          .eq('id', membership.guild_id)
          .single();

        if (guildError) throw guildError;
        setMyGuild(guild as Guild);

        // Fetch guild members
        await fetchGuildMembers(membership.guild_id);
      } else {
        setMyMembership(null);
        setMyGuild(null);
      }
    } catch (error: any) {
      console.error('Error fetching my guild:', error);
    }
  }, [user]);

  // Fetch guild members
  const fetchGuildMembers = async (guildId: string) => {
    try {
      const { data: members, error } = await supabase
        .from('guild_members')
        .select('*')
        .eq('guild_id', guildId)
        .order('role');

      if (error) throw error;

      // Get profile and stats for each member
      const membersWithDetails = await Promise.all(
        (members || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('hunter_name, avatar')
            .eq('user_id', member.user_id)
            .maybeSingle();

          const { data: stats } = await supabase
            .from('player_stats')
            .select('level, strength, agility, intelligence, vitality, sense')
            .eq('user_id', member.user_id)
            .maybeSingle();

          const power = stats
            ? stats.strength + stats.agility + stats.intelligence + stats.vitality + stats.sense
            : 0;

          return {
            ...member,
            hunter_name: profile?.hunter_name || 'Unknown',
            avatar: profile?.avatar,
            level: stats?.level || 1,
            power,
          } as GuildMember;
        })
      );

      setGuildMembers(membersWithDetails);
    } catch (error: any) {
      console.error('Error fetching guild members:', error);
    }
  };

  // Fetch guild messages
  const fetchGuildMessages = useCallback(async (guildId: string) => {
    try {
      const { data, error } = await supabase
        .from('guild_messages')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Get sender names
      const messagesWithNames = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('hunter_name')
            .eq('user_id', msg.user_id)
            .maybeSingle();

          return {
            ...msg,
            sender_name: profile?.hunter_name || 'Unknown',
          } as GuildMessage;
        })
      );

      setGuildMessages(messagesWithNames);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  // Fetch user's invites
  const fetchMyInvites = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('guild_invites')
        .select('*')
        .eq('invitee_id', user.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (error) throw error;

      // Get guild names and inviter names
      const invitesWithDetails = await Promise.all(
        (data || []).map(async (invite) => {
          const { data: guild } = await supabase
            .from('guilds')
            .select('name')
            .eq('id', invite.guild_id)
            .maybeSingle();

          const { data: inviter } = await supabase
            .from('profiles')
            .select('hunter_name')
            .eq('user_id', invite.inviter_id)
            .maybeSingle();

          return {
            ...invite,
            guild_name: guild?.name || 'Unknown Guild',
            inviter_name: inviter?.hunter_name || 'Unknown',
          } as GuildInvite;
        })
      );

      setMyInvites(invitesWithDetails);
    } catch (error: any) {
      console.error('Error fetching invites:', error);
    }
  }, [user]);

  // Fetch sent invites (for guild leaders to manage)
  const fetchSentInvites = useCallback(async () => {
    if (!user || !myGuild) {
      setSentInvites([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('guild_invites')
        .select('*')
        .eq('guild_id', myGuild.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (error) throw error;

      // Get invitee names
      const invitesWithDetails = await Promise.all(
        (data || []).map(async (invite) => {
          const { data: invitee } = await supabase
            .from('profiles')
            .select('hunter_name')
            .eq('user_id', invite.invitee_id)
            .maybeSingle();

          return {
            ...invite,
            invitee_name: invitee?.hunter_name || 'Unknown',
          } as GuildInvite;
        })
      );

      setSentInvites(invitesWithDetails);
    } catch (error: any) {
      console.error('Error fetching sent invites:', error);
    }
  }, [user, myGuild]);

  // Create a guild
  const createGuild = async (name: string, description: string, accessType: 'public' | 'private' | 'invite_only') => {
    if (!user) return false;

    try {
      // Check if user is already in a guild
      if (myGuild) {
        toast({
          variant: "destructive",
          title: "Already in a Guild",
          description: "Leave your current guild before creating a new one.",
        });
        return false;
      }

      const { data: guild, error: guildError } = await supabase
        .from('guilds')
        .insert({
          name,
          description,
          access_type: accessType,
          master_id: user.id,
        })
        .select()
        .single();

      if (guildError) throw guildError;

      // Add creator as guild master
      const { error: memberError } = await supabase
        .from('guild_members')
        .insert({
          guild_id: guild.id,
          user_id: user.id,
          role: 'guild_master',
        });

      if (memberError) throw memberError;

      toast({
        title: "Guild Created!",
        description: `${name} has been established. Lead your hunters to glory!`,
      });

      await fetchMyGuild();
      await fetchGuilds();
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Failed to create guild.",
      });
      return false;
    }
  };

  // Join a guild
  const joinGuild = async (guildId: string) => {
    if (!user) return false;

    try {
      if (myGuild) {
        toast({
          variant: "destructive",
          title: "Already in a Guild",
          description: "Leave your current guild first.",
        });
        return false;
      }

      const { error } = await supabase
        .from('guild_members')
        .insert({
          guild_id: guildId,
          user_id: user.id,
          role: 'member',
        });

      if (error) throw error;

      toast({
        title: "Joined Guild!",
        description: "Welcome to your new guild!",
      });

      await fetchMyGuild();
      await fetchGuilds();
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Join Failed",
        description: error.message || "Failed to join guild.",
      });
      return false;
    }
  };

  // Leave guild
  const leaveGuild = async () => {
    if (!user || !myMembership) return false;

    try {
      if (myMembership.role === 'guild_master') {
        toast({
          variant: "destructive",
          title: "Cannot Leave",
          description: "Transfer leadership or disband the guild first.",
        });
        return false;
      }

      const { error } = await supabase
        .from('guild_members')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Left Guild",
        description: "You have left the guild.",
      });

      setMyGuild(null);
      setMyMembership(null);
      setGuildMembers([]);
      await fetchGuilds();
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Leave Failed",
        description: error.message || "Failed to leave guild.",
      });
      return false;
    }
  };

  // Disband guild
  const disbandGuild = async () => {
    if (!user || !myGuild || myMembership?.role !== 'guild_master') return false;

    try {
      const { error } = await supabase
        .from('guilds')
        .delete()
        .eq('id', myGuild.id);

      if (error) throw error;

      toast({
        title: "Guild Disbanded",
        description: "The guild has been dissolved.",
      });

      setMyGuild(null);
      setMyMembership(null);
      setGuildMembers([]);
      await fetchGuilds();
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Disband Failed",
        description: error.message || "Failed to disband guild.",
      });
      return false;
    }
  };

  // Send message
  const sendMessage = async (message: string) => {
    if (!user || !myGuild) return false;

    try {
      const { error } = await supabase
        .from('guild_messages')
        .insert({
          guild_id: myGuild.id,
          user_id: user.id,
          message,
        });

      if (error) throw error;
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Send Failed",
        description: error.message || "Failed to send message.",
      });
      return false;
    }
  };

  // Accept invite
  const acceptInvite = async (inviteId: string, guildId: string) => {
    if (!user) return false;

    try {
      if (myGuild) {
        toast({
          variant: "destructive",
          title: "Already in a Guild",
          description: "Leave your current guild first.",
        });
        return false;
      }

      // Join the guild FIRST while invite status is still 'pending' (required by RLS)
      const { error: joinError } = await supabase
        .from('guild_members')
        .insert({
          guild_id: guildId,
          user_id: user.id,
          role: 'member',
        });

      if (joinError) throw joinError;

      // THEN update invite status to 'accepted'
      await supabase
        .from('guild_invites')
        .update({ status: 'accepted' })
        .eq('id', inviteId);

      toast({
        title: "Joined Guild!",
        description: "Welcome to your new guild!",
      });

      await fetchMyGuild();
      await fetchGuilds();
      await fetchMyInvites();
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Accept Failed",
        description: error.message || "Failed to accept invite.",
      });
      return false;
    }
  };

  // Decline invite
  const declineInvite = async (inviteId: string) => {
    if (!user) return false;

    try {
      await supabase
        .from('guild_invites')
        .update({ status: 'declined' })
        .eq('id', inviteId);

      await fetchMyInvites();
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Decline Failed",
        description: error.message || "Failed to decline invite.",
      });
      return false;
    }
  };

  // Search for users to invite
  const searchUsers = async (query: string) => {
    if (!user || !myGuild || query.length < 2) return [];

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, hunter_name, avatar')
        .ilike('hunter_name', `%${query}%`)
        .neq('user_id', user.id)
        .limit(10);

      if (error) throw error;

      // Filter out users already in the guild
      const memberUserIds = guildMembers.map(m => m.user_id);
      return (data || []).filter(u => !memberUserIds.includes(u.user_id));
    } catch (error: any) {
      console.error('Error searching users:', error);
      return [];
    }
  };

  // Send guild invite
  const sendInvite = async (inviteeId: string, inviteeName: string) => {
    if (!user || !myGuild) return false;

    // Check if user has permission (elite or higher)
    if (!myMembership || !['guild_master', 'vice_master', 'elite'].includes(myMembership.role)) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only Elite members and above can invite hunters.",
      });
      return false;
    }

    try {
      // Check if invite already exists
      const { data: existing } = await supabase
        .from('guild_invites')
        .select('id, status')
        .eq('guild_id', myGuild.id)
        .eq('invitee_id', inviteeId)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'pending') {
          toast({
            variant: "destructive",
            title: "Already Invited",
            description: `${inviteeName} already has a pending invite.`,
          });
          return false;
        }
        // Delete old non-pending invite to allow re-inviting
        await supabase
          .from('guild_invites')
          .delete()
          .eq('id', existing.id);
      }

      // Check if user is already in a guild
      const { data: existingMember } = await supabase
        .from('guild_members')
        .select('id')
        .eq('user_id', inviteeId)
        .maybeSingle();

      if (existingMember) {
        toast({
          variant: "destructive",
          title: "Already in Guild",
          description: `${inviteeName} is already in a guild.`,
        });
        return false;
      }

      const { error } = await supabase
        .from('guild_invites')
        .insert({
          guild_id: myGuild.id,
          inviter_id: user.id,
          invitee_id: inviteeId,
        });

      if (error) throw error;

      toast({
        title: "Invite Sent!",
        description: `Guild invitation sent to ${inviteeName}.`,
      });
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Invite Failed",
        description: error.message || "Failed to send invite.",
      });
      return false;
    }
  };

  // Revoke a pending invite
  const revokeInvite = async (inviteId: string) => {
    if (!user || !myGuild) return false;

    // Check if user has permission (leader)
    if (!myMembership || !['guild_master', 'vice_master'].includes(myMembership.role)) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only guild leaders can revoke invites.",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('guild_invites')
        .delete()
        .eq('id', inviteId)
        .eq('guild_id', myGuild.id);

      if (error) throw error;

      toast({
        title: "Invite Revoked",
        description: "The invitation has been cancelled.",
      });
      await fetchSentInvites();
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Revoke Failed",
        description: error.message || "Failed to revoke invite.",
      });
      return false;
    }
  };

  // Promote a guild member
  const promoteMember = async (memberId: string, currentRole: string) => {
    if (!user || !myGuild) return false;

    // Only guild master can promote
    if (myMembership?.role !== 'guild_master') {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only the Guild Master can promote members.",
      });
      return false;
    }

    const roleHierarchy = ['member', 'elite', 'vice_master'];
    const currentIndex = roleHierarchy.indexOf(currentRole);
    
    if (currentIndex === -1 || currentIndex >= roleHierarchy.length - 1) {
      toast({
        variant: "destructive",
        title: "Cannot Promote",
        description: "This member cannot be promoted further.",
      });
      return false;
    }

    const newRole = roleHierarchy[currentIndex + 1] as 'elite' | 'vice_master';

    try {
      const { error } = await supabase
        .from('guild_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Member Promoted!",
        description: `Promoted to ${newRole === 'vice_master' ? 'Vice Master' : 'Elite'}.`,
      });
      if (myGuild) await fetchGuildMembers(myGuild.id);
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Promotion Failed",
        description: error.message || "Failed to promote member.",
      });
      return false;
    }
  };

  // Demote a guild member
  const demoteMember = async (memberId: string, currentRole: string) => {
    if (!user || !myGuild) return false;

    // Only guild master can demote
    if (myMembership?.role !== 'guild_master') {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only the Guild Master can demote members.",
      });
      return false;
    }

    const roleHierarchy = ['member', 'elite', 'vice_master'];
    const currentIndex = roleHierarchy.indexOf(currentRole);
    
    if (currentIndex <= 0) {
      toast({
        variant: "destructive",
        title: "Cannot Demote",
        description: "This member cannot be demoted further.",
      });
      return false;
    }

    const newRole = roleHierarchy[currentIndex - 1] as 'member' | 'elite';

    try {
      const { error } = await supabase
        .from('guild_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Member Demoted",
        description: `Demoted to ${newRole === 'elite' ? 'Elite' : 'Member'}.`,
      });
      if (myGuild) await fetchGuildMembers(myGuild.id);
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Demotion Failed",
        description: error.message || "Failed to demote member.",
      });
      return false;
    }
  };

  // Kick a member from the guild
  const kickMember = async (memberId: string, memberUserId: string) => {
    if (!user || !myGuild) return false;

    // Only guild master can kick
    if (myMembership?.role !== 'guild_master') {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "Only the Guild Master can kick members.",
      });
      return false;
    }

    // Cannot kick yourself
    if (memberUserId === user.id) {
      toast({
        variant: "destructive",
        title: "Cannot Kick",
        description: "You cannot kick yourself. Use disband instead.",
      });
      return false;
    }

    try {
      const { error } = await supabase
        .from('guild_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Member Kicked",
        description: "The member has been removed from the guild.",
      });
      if (myGuild) await fetchGuildMembers(myGuild.id);
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Kick Failed",
        description: error.message || "Failed to kick member.",
      });
      return false;
    }
  };

  // Set up realtime subscription for messages
  useEffect(() => {
    if (!myGuild) return;

    const channel = supabase
      .channel('guild-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guild_messages',
          filter: `guild_id=eq.${myGuild.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as GuildMessage;
          
          // Get sender name
          const { data: profile } = await supabase
            .from('profiles')
            .select('hunter_name')
            .eq('user_id', newMessage.user_id)
            .maybeSingle();

          setGuildMessages((prev) => [
            ...prev,
            { ...newMessage, sender_name: profile?.hunter_name || 'Unknown' },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myGuild?.id]);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchGuilds(), fetchMyGuild(), fetchMyInvites()]);
      setLoading(false);
    };
    init();
  }, [user, fetchGuilds, fetchMyGuild, fetchMyInvites]);

  // Fetch messages and sent invites when guild changes
  useEffect(() => {
    if (myGuild) {
      fetchGuildMessages(myGuild.id);
      fetchSentInvites();
    }
  }, [myGuild?.id, fetchGuildMessages, fetchSentInvites]);

  return {
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
    refreshGuilds: fetchGuilds,
    refreshMyGuild: fetchMyGuild,
    refreshSentInvites: fetchSentInvites,
  };
};
