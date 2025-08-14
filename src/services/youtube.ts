import YouTube from 'youtube-sr';
import { Track } from '../types';
import { logger } from '../utils/logger';
import ytdl from 'ytdl-core';
import play from 'play-dl';

export class YouTubeService {
  constructor() {
    logger.info('YouTube service initialized');
  }

  async search(query: string): Promise<Track | null> {
    logger.info(`[YouTube] Search initiated with query: ${query}`);
    logger.debug(`[YouTube] Query type: ${this.isYouTubeUrl(query) ? 'URL' : 'Search term'}`);
    
    try {
      // Check if it's a YouTube URL
      if (this.isYouTubeUrl(query)) {
        logger.info(`[YouTube] Detected YouTube URL, extracting track info from: ${query}`);
        return await this.getTrackFromUrl(query);
      }

      // Search using youtube-sr first (simpler API)
      logger.info(`[YouTube] Performing search with youtube-sr for: ${query}`);
      try {
        const results = await YouTube.search(query, { limit: 1, type: 'video' });
        logger.debug(`[YouTube] Search returned ${results.length} results`);
        
        if (results.length > 0) {
          const video = results[0];
          logger.info(`[YouTube] Found video: ${video.title} - URL: ${video.url}`);
          return {
            title: String(video.title || 'Unknown Title'),
            url: String(video.url),
            duration: video.duration || 0,
            thumbnail: String(video.thumbnail?.displayThumbnailURL() || ''),
            requestedBy: '',
          };
        }
      } catch (srError) {
        logger.warn('[YouTube] youtube-sr search failed:', {
          error: srError instanceof Error ? srError.message : String(srError),
          query: query
        });
      }

      // Fallback to play-dl search
      logger.info(`[YouTube] Trying play-dl search for: ${query}`);
      try {
        const results = await play.search(query, { 
          limit: 1,
          source: { youtube: 'video' }
        });
        
        if (results.length > 0) {
          const video = results[0];
          logger.info(`[YouTube] Found video with play-dl: ${video.title} - URL: ${video.url}`);
          return {
            title: String(video.title || 'Unknown Title'),
            url: String(video.url || ''),
            duration: video.durationInSec ? video.durationInSec * 1000 : 0,
            thumbnail: String(video.thumbnails?.[0]?.url || ''),
            requestedBy: '',
          };
        }
      } catch (playError) {
        logger.error('[YouTube] play-dl search failed:', {
          error: playError instanceof Error ? playError.message : String(playError),
          query: query
        });
      }

      logger.warn(`[YouTube] No results found for query: ${query}`);
      return null;
    } catch (error) {
      logger.error('[YouTube] Search error:', {
        error: error instanceof Error ? error.message : String(error),
        query: query,
        stack: error instanceof Error ? error.stack : undefined
      });
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
    logger.info(`[YouTube] Extracting track from URL: ${url}`);
    
    // Extract video ID from URL
    const videoId = this.extractVideoId(url);
    logger.debug(`[YouTube] Extracted video ID: ${videoId}`);
    
    if (!videoId) {
      logger.error('[YouTube] Could not extract video ID from URL:', { url });
      return null;
    }

    // Method 1: Try play-dl first (most reliable currently)
    try {
      logger.info(`[YouTube] Attempting to get info with play-dl for URL: ${url}`);
      
      // Validate URL first
      const urlType = await play.validate(url);
      if (urlType === 'yt_video') {
        const info = await play.video_info(url);
        
        if (info && info.video_details) {
          logger.info(`[YouTube] Successfully got info from play-dl: ${info.video_details.title}`);
          const track = {
            title: String(info.video_details.title || 'Unknown Title'),
            url: String(url),
            duration: info.video_details.durationInSec ? info.video_details.durationInSec * 1000 : 0,
            thumbnail: String(info.video_details.thumbnails?.[0]?.url || ''),
            requestedBy: '',
          };
          logger.debug('[YouTube] Track details from play-dl:', track);
          return track;
        }
      } else {
        logger.warn(`[YouTube] play-dl validation failed, URL type: ${urlType}`);
      }
    } catch (playError) {
      logger.warn('[YouTube] play-dl getInfo failed:', {
        error: playError instanceof Error ? playError.message : String(playError),
        url: url,
        videoId: videoId
      });
    }

    // Method 2: Try ytdl-core as fallback
    try {
      logger.info(`[YouTube] Attempting to get info with ytdl-core for URL: ${url}`);
      
      const info = await ytdl.getInfo(url, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        },
      });
      
      if (info && info.videoDetails) {
        logger.info(`[YouTube] Successfully got info from ytdl-core: ${info.videoDetails.title}`);
        const track = {
          title: String(info.videoDetails.title || 'Unknown Title'),
          url: String(url),
          duration: parseInt(info.videoDetails.lengthSeconds || '0') * 1000,
          thumbnail: String(info.videoDetails.thumbnails?.[0]?.url || ''),
          requestedBy: '',
        };
        logger.debug('[YouTube] Track details from ytdl-core:', track);
        return track;
      }
    } catch (ytdlError) {
      logger.warn('[YouTube] ytdl-core getInfo failed:', {
        error: ytdlError instanceof Error ? ytdlError.message : String(ytdlError),
        url: url,
        videoId: videoId
      });
    }

    // Method 3: Try youtube-sr with timeout as last resort
    try {
      logger.info(`[YouTube] Falling back to youtube-sr for URL: ${url}`);
      
      // Create a timeout promise
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('youtube-sr timeout')), 5000);
      });
      
      // Race between getVideo and timeout
      const video = await Promise.race([
        YouTube.getVideo(url),
        timeoutPromise
      ]);
      
      if (video) {
        logger.info(`[YouTube] Successfully got info from youtube-sr: ${video.title}`);
        return {
          title: String(video.title || 'Unknown Title'),
          url: String(url),
          duration: video.duration || 0,
          thumbnail: String(video.thumbnail?.displayThumbnailURL() || ''),
          requestedBy: '',
        };
      }
    } catch (srError) {
      logger.error('[YouTube] youtube-sr getVideo failed:', {
        error: srError instanceof Error ? srError.message : String(srError),
        url: url,
        videoId: videoId
      });
    }

    // All methods failed
    logger.error('[YouTube] All methods failed to get track info from URL:', { url, videoId });
    return null;
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