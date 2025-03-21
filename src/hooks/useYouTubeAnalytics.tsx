
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface VideoAnalytics {
  id: string;
  user_id: string;
  video_id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  watch_time: number;
  created_at: string;
  updated_at: string;
}

export interface YouTubeChannel {
  id: string;
  user_id: string;
  channel_name: string;
  channel_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useYouTubeAnalytics = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch user's YouTube channel information
  const { data: channelInfo, isLoading: isLoadingChannel } = useQuery({
    queryKey: ['youtube-channel', user?.id],
    queryFn: async (): Promise<YouTubeChannel | null> => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        if (error.code !== 'PGRST116') { // PGRST116 is "No rows returned" error
          console.error('Error fetching YouTube channel:', error);
          toast.error('Failed to load YouTube channel information');
        }
        return null;
      }
      
      return data;
    },
    enabled: !!user,
  });

  // Save or update YouTube channel information
  const saveChannel = useMutation({
    mutationFn: async ({ channelName }: { channelName: string }) => {
      if (!user) throw new Error('User not authenticated');
      
      // Check if channel already exists for this user
      const { data: existingChannel, error: checkError } = await supabase
        .from('youtube_channels')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking for existing channel:', checkError);
        throw checkError;
      }
      
      if (existingChannel) {
        // Update existing channel
        const { error: updateError } = await supabase
          .from('youtube_channels')
          .update({ 
            channel_name: channelName,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingChannel.id);
        
        if (updateError) {
          console.error('Error updating YouTube channel:', updateError);
          throw updateError;
        }
        
        return { channelName, isNew: false };
      } else {
        // Create new channel
        const { error: insertError } = await supabase
          .from('youtube_channels')
          .insert({
            user_id: user.id,
            channel_name: channelName
          });
        
        if (insertError) {
          console.error('Error saving YouTube channel:', insertError);
          throw insertError;
        }
        
        return { channelName, isNew: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-channel', user?.id] });
      toast.success('YouTube channel information saved successfully');
    },
    onError: (error) => {
      toast.error(`Failed to save YouTube channel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
  
  // Fetch user's video analytics
  const { data: videos, isLoading, error } = useQuery({
    queryKey: ['video-analytics', user?.id],
    queryFn: async (): Promise<VideoAnalytics[]> => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('video_analytics')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching video analytics:', error);
        toast.error('Failed to load video analytics');
        throw error;
      }
      
      return data || [];
    },
    enabled: !!user,
  });

  // Mock function to simulate fetching YouTube analytics
  // In a real app, this would connect to the YouTube API
  const fetchYouTubeStats = async (channelName: string) => {
    // Demo data to simulate YouTube API response
    const mockVideos = [
      {
        video_id: 'video1',
        title: 'How I Made $100K in One Day',
        views: 125000 + Math.floor(Math.random() * 10000),
        likes: 15400 + Math.floor(Math.random() * 1000),
        comments: 1200 + Math.floor(Math.random() * 100),
        watch_time: 345600 + Math.floor(Math.random() * 10000),
      },
      {
        video_id: 'video2',
        title: 'My Morning Routine for Success',
        views: 89000 + Math.floor(Math.random() * 5000),
        likes: 7300 + Math.floor(Math.random() * 500),
        comments: 840 + Math.floor(Math.random() * 100),
        watch_time: 267800 + Math.floor(Math.random() * 8000),
      },
      {
        video_id: 'video3',
        title: 'Top 10 Investment Tips for 2023',
        views: 210000 + Math.floor(Math.random() * 15000),
        likes: 18700 + Math.floor(Math.random() * 1200),
        comments: 2200 + Math.floor(Math.random() * 150),
        watch_time: 423000 + Math.floor(Math.random() * 12000),
      }
    ];
    
    // Add channel name to console for demonstration
    console.log(`Fetching stats for channel: ${channelName}`);
    
    return mockVideos;
  };

  // Sync YouTube analytics with our database
  const syncYouTubeAnalytics = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not found');
      if (!channelInfo) throw new Error('Please set up your YouTube channel first');
      
      // Fetch latest stats from YouTube API (mocked)
      const youtubeVideos = await fetchYouTubeStats(channelInfo.channel_name);
      
      // Update each video in our database
      const updatePromises = youtubeVideos.map(async (video) => {
        const { data, error } = await supabase
          .from('video_analytics')
          .upsert({
            user_id: user.id,
            video_id: video.video_id,
            title: video.title,
            views: video.views,
            likes: video.likes,
            comments: video.comments,
            watch_time: video.watch_time,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,video_id'
          })
          .select();
        
        if (error) {
          console.error('Error syncing video analytics:', error);
          throw error;
        }
        
        return data;
      });
      
      await Promise.all(updatePromises);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-analytics', user?.id] });
      toast.success('YouTube analytics synchronized successfully');
    },
    onError: (error) => {
      toast.error('Failed to sync YouTube analytics');
      console.error(error);
    }
  });

  // Calculate total stats
  const totalStats = videos ? {
    videos: videos.length,
    views: videos.reduce((sum, video) => sum + video.views, 0),
    likes: videos.reduce((sum, video) => sum + video.likes, 0),
    comments: videos.reduce((sum, video) => sum + video.comments, 0),
    watchTimeHours: Math.round(videos.reduce((sum, video) => sum + video.watch_time, 0) / 3600)
  } : null;

  return {
    videos,
    isLoading,
    error,
    syncYouTubeAnalytics,
    totalStats,
    channelInfo,
    isLoadingChannel,
    saveChannel
  };
};
