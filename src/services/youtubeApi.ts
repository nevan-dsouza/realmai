
import { supabase } from "@/integrations/supabase/client";

export interface YouTubeChannelResponse {
  items: {
    id: string;
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        default: { url: string };
        medium: { url: string };
        high: { url: string };
      };
      publishedAt: string;
    };
    statistics: {
      viewCount: string;
      subscriberCount: string;
      videoCount: string;
    };
  }[];
}

export interface YouTubeSearchResponse {
  items: {
    id: {
      kind: string;
      channelId: string;
    };
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        default: { url: string };
        medium: { url: string };
        high: { url: string };
      };
      channelTitle: string;
      publishedAt: string;
    };
  }[];
}

// Mock data for when the API fails or for testing
const MOCK_CHANNELS = [
  {
    id: "UCX6OQ3DkcsbYNE6H8uQQuVA",
    snippet: {
      title: "MrBeast",
      description: "I make YouTube videos.",
      thumbnails: {
        default: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZTUVa5AeFd3m5-4fdY9Fj9Seb0cjw4Z9SJD0jXAqQ=s88-c-k-c0xffffffff-no-rj-mo" },
        medium: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZTUVa5AeFd3m5-4fdY9Fj9Seb0cjw4Z9SJD0jXAqQ=s240-c-k-c0xffffffff-no-rj-mo" },
        high: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZTUVa5AeFd3m5-4fdY9Fj9Seb0cjw4Z9SJD0jXAqQ=s800-c-k-c0xffffffff-no-rj-mo" }
      },
      publishedAt: "2012-06-24T00:00:00Z"
    },
    statistics: {
      viewCount: "32000000000",
      subscriberCount: "235000000",
      videoCount: "742"
    }
  },
  {
    id: "UC6nSFpj9HTCZ5t-N3Rm3-HA",
    snippet: {
      title: "Vsauce",
      description: "Our world is amazing. Welcome to Vsauce.",
      thumbnails: {
        default: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZR7VipUCwMmmeT_YZBXzUXiPkO0OOeHRAiXPg_e=s88-c-k-c0xffffffff-no-rj-mo" },
        medium: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZR7VipUCwMmmeT_YZBXzUXiPkO0OOeHRAiXPg_e=s240-c-k-c0xffffffff-no-rj-mo" },
        high: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZR7VipUCwMmmeT_YZBXzUXiPkO0OOeHRAiXPg_e=s800-c-k-c0xffffffff-no-rj-mo" }
      },
      publishedAt: "2010-07-30T00:00:00Z"
    },
    statistics: {
      viewCount: "2500000000",
      subscriberCount: "17800000",
      videoCount: "389"
    }
  },
  {
    id: "UCBJycsmduvYEL83R_U4JriQ",
    snippet: {
      title: "Marques Brownlee",
      description: "MKBHD: Quality Tech Videos.",
      thumbnails: {
        default: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZTmdjQEgEoQl_Y9F7xCGbuV03sRJhcxUEReRYIBCg=s88-c-k-c0xffffffff-no-rj-mo" },
        medium: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZTmdjQEgEoQl_Y9F7xCGbuV03sRJhcxUEReRYIBCg=s240-c-k-c0xffffffff-no-rj-mo" },
        high: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZTmdjQEgEoQl_Y9F7xCGbuV03sRJhcxUEReRYIBCg=s800-c-k-c0xffffffff-no-rj-mo" }
      },
      publishedAt: "2008-10-21T00:00:00Z"
    },
    statistics: {
      viewCount: "3100000000",
      subscriberCount: "18200000",
      videoCount: "1456"
    }
  },
  {
    id: "UCXuqSBlHAE6Xw-yeJA0Tunw",
    snippet: {
      title: "Linus Tech Tips",
      description: "Tech can be complicated; we try to make it easy.",
      thumbnails: {
        default: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZTcnR8M83Kh1Gf8KGPWcFBQCc4hyvsxZgNLYH0n=s88-c-k-c0xffffffff-no-rj-mo" },
        medium: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZTcnR8M83Kh1Gf8KGPWcFBQCc4hyvsxZgNLYH0n=s240-c-k-c0xffffffff-no-rj-mo" },
        high: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZTcnR8M83Kh1Gf8KGPWcFBQCc4hyvsxZgNLYH0n=s800-c-k-c0xffffffff-no-rj-mo" }
      },
      publishedAt: "2008-11-24T00:00:00Z"
    },
    statistics: {
      viewCount: "7800000000",
      subscriberCount: "15600000",
      videoCount: "5872"
    }
  },
  {
    id: "UCUpxnSzY9ylkSQxWp-reaOQ",
    snippet: {
      title: "Veritasium",
      description: "An element of truth - videos about science, education, and anything else that's fascinating.",
      thumbnails: {
        default: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZQ8IsSvRSazKu3aVeZC8MRZNBuAD13wVnwWY_Kpsw=s88-c-k-c0xffffffff-no-rj-mo" },
        medium: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZQ8IsSvRSazKu3aVeZC8MRZNBuAD13wVnwWY_Kpsw=s240-c-k-c0xffffffff-no-rj-mo" },
        high: { url: "https://yt3.googleusercontent.com/ytc/AIf8zZQ8IsSvRSazKu3aVeZC8MRZNBuAD13wVnwWY_Kpsw=s800-c-k-c0xffffffff-no-rj-mo" }
      },
      publishedAt: "2010-07-21T00:00:00Z"
    },
    statistics: {
      viewCount: "1900000000",
      subscriberCount: "14300000",
      videoCount: "223"
    }
  }
];

export const searchYouTubeChannels = async (query: string): Promise<YouTubeChannelResponse['items']> => {
  try {
    console.log(`Searching for YouTube channels with query: ${query}`);
    
    // Call the edge function instead of directly calling YouTube API
    const { data, error } = await supabase.functions.invoke('youtube-api', {
      body: {
        operation: 'search_channels',
        query: query
      }
    });
    
    if (error) {
      console.error('Error calling YouTube API edge function:', error);
      // Return filtered mock data based on the search query
      return MOCK_CHANNELS.filter(channel => 
        channel.snippet.title.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    if (!data.items || data.items.length === 0) {
      console.log("No channels found, returning mock data");
      return MOCK_CHANNELS.filter(channel => 
        channel.snippet.title.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    return data.items;
    
  } catch (error) {
    console.error('Error searching YouTube channels:', error);
    // Return filtered mock data based on the search query
    return MOCK_CHANNELS.filter(channel => 
      channel.snippet.title.toLowerCase().includes(query.toLowerCase())
    );
  }
};

export const getChannelDetails = async (channelId: string): Promise<YouTubeChannelResponse['items']> => {
  try {
    console.log(`Fetching channel details for: ${channelId}`);
    
    // Call the edge function instead of directly calling YouTube API
    const { data, error } = await supabase.functions.invoke('youtube-api', {
      body: {
        operation: 'get_channel_details',
        channelId: channelId
      }
    });
    
    if (error) {
      console.error('Error calling YouTube API edge function:', error);
      // Find the matching channel in mock data or return the first one
      const matchedChannel = MOCK_CHANNELS.find(channel => channel.id === channelId);
      return matchedChannel ? [matchedChannel] : [MOCK_CHANNELS[0]];
    }
    
    if (!data.items || data.items.length === 0) {
      console.log("No channel details found, returning mock data");
      const matchedChannel = MOCK_CHANNELS.find(channel => channel.id === channelId);
      return matchedChannel ? [matchedChannel] : [MOCK_CHANNELS[0]];
    }
    
    return data.items;
    
  } catch (error) {
    console.error('Error fetching channel details:', error);
    // Find the matching channel in mock data or return the first one
    const matchedChannel = MOCK_CHANNELS.find(channel => channel.id === channelId);
    return matchedChannel ? [matchedChannel] : [MOCK_CHANNELS[0]];
  }
};

// Function to get channel statistics history (growth metrics)
export const getChannelGrowthStats = async (channelId: string) => {
  // In a real app, we'd fetch historical data from YouTube Analytics API
  // For this example, we'll generate mock growth data based on current stats
  try {
    const channelData = await getChannelDetails(channelId);
    
    if (!channelData || channelData.length === 0) {
      return null;
    }
    
    const channel = channelData[0];
    const currentSubs = parseInt(channel.statistics.subscriberCount);
    const currentViews = parseInt(channel.statistics.viewCount);
    
    // Calculate mock growth data (in a real app, this would come from actual historical data)
    const mockGrowthData = {
      subscribers: {
        monthly: Math.floor(currentSubs * 0.03), // 3% monthly growth
        weekly: Math.floor(currentSubs * 0.007), // 0.7% weekly growth
        daily: Math.floor(currentSubs * 0.001), // 0.1% daily growth
      },
      views: {
        monthly: Math.floor(currentViews * 0.05), // 5% monthly growth
        weekly: Math.floor(currentViews * 0.012), // 1.2% weekly growth
        daily: Math.floor(currentViews * 0.002), // 0.2% daily growth
      },
      engagement: (Math.random() * 3 + 2).toFixed(2) + '%', // 2-5% engagement rate
      growthRate: (Math.random() * 5 + 1).toFixed(2) + '%', // 1-6% growth rate
    };
    
    return mockGrowthData;
  } catch (error) {
    console.error('Error generating growth stats:', error);
    return null;
  }
};
