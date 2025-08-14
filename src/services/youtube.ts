import YouTube from 'youtube-sr';
import { Track } from '../types';
import { logger } from '../utils/logger';
import ytdl from 'ytdl-core';

export class YouTubeService {
  constructor() {
    logger.info('YouTube service initialized');
  }

  async search(query: string): Promise<Track | null> {
    try {
      // Check if it's a YouTube URL
      if (this.isYouTubeUrl(query)) {
        return await this.getTrackFromUrl(query);
      }

      // Search using youtube-sr first (simpler API)
      try {
        const results = await YouTube.search(query, { limit: 1, type: 'video' });
        
        if (results.length > 0) {
          const video = results[0];
          return {
            title: String(video.title || 'Unknown Title'),
            url: String(video.url),
            duration: video.duration || 0,
            thumbnail: String(video.thumbnail?.displayThumbnailURL() || ''),
            requestedBy: '',
          };
        }
      } catch (srError) {
        logger.warn('youtube-sr search failed:', srError);
      }

      // If youtube-sr fails, we'll return null

      return null;
    } catch (error) {
      logger.error('YouTube search error:', error);
      return null;
    }
  }

  private isYouTubeUrl(query: string): boolean {
    const patterns = [
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com|m\.youtube\.com)\/.+/,
      /youtube\.com\/watch\?v=/,
      /youtu\.be\//,
      /youtube\.com\/embed\//,
      /music\.youtube\.com\/watch\?v=/,
      /youtube\.com\/shorts\//,
    ];
    
    return patterns.some(pattern => pattern.test(query));
  }

  private async getTrackFromUrl(url: string): Promise<Track | null> {
    try {
      // Extract video ID from URL
      const videoId = this.extractVideoId(url);
      if (!videoId) {
        logger.error('Could not extract video ID from URL:', url);
        return null;
      }

      // Try using ytdl-core to get video info
      try {
        const info = await ytdl.getInfo(url, {
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          },
        });
        
        if (info && info.videoDetails) {
          return {
            title: String(info.videoDetails.title || 'Unknown Title'),
            url: String(url),
            duration: parseInt(info.videoDetails.lengthSeconds || '0') * 1000,
            thumbnail: String(info.videoDetails.thumbnails?.[0]?.url || ''),
            requestedBy: '',
          };
        }
      } catch (ytdlError) {
        logger.warn('ytdl-core getInfo failed:', ytdlError);
      }

      // Fallback to youtube-sr
      const video = await YouTube.getVideo(url);
      if (video) {
        return {
          title: String(video.title || 'Unknown Title'),
          url: String(url),
          duration: video.duration || 0,
          thumbnail: String(video.thumbnail?.displayThumbnailURL() || ''),
          requestedBy: '',
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get track info from URL:', error);
      return null;
    }
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  async getStreamUrl(url: string): Promise<string | null> {
    // For ytdl-core, we'll handle streaming directly in the player
    // This method is kept for compatibility but returns the original URL
    return url;
  }
}