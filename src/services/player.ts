import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  StreamType,
} from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
import { logger } from '../utils/logger';
import { QueueItem, Track } from '../types';
import { config } from '../config';
import ytdl from 'ytdl-core';
import play from 'play-dl';
import { ytDlpExtractor } from '../utils/ytdlp';
import { EventEmitter } from 'events';

export class MusicPlayer extends EventEmitter {
  private audioPlayer: AudioPlayer;
  private connection?: VoiceConnection;
  private queue: QueueItem[] = [];
  private currentTrack?: QueueItem;
  private isPaused: boolean = false;
  private volume: number;
  private playbackStartPromise?: { resolve: (success: boolean) => void; reject: (error: any) => void };
  
  constructor() {
    super();
    this.audioPlayer = createAudioPlayer();
    this.volume = config.music.defaultVolume / 100;
    this.setupPlayerHandlers();
  }


  private setupPlayerHandlers(): void {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      logger.info('Audio player idle, moving to next track');
      this.currentTrack = undefined;
      this.playNext();
    });

    this.audioPlayer.on('error', (error) => {
      logger.error('Audio player error:', error.message || 'Unknown error');
      if (error.resource && error.resource.metadata) {
        logger.error('Resource metadata available');
      }
      this.currentTrack = undefined;
      this.playNext();
    });

    this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
      logger.info('Audio player started playing');
      if (this.playbackStartPromise) {
        this.playbackStartPromise.resolve(true);
        this.playbackStartPromise = undefined;
      }
      this.emit('trackStart', this.currentTrack);
    });

    this.audioPlayer.on(AudioPlayerStatus.Buffering, () => {
      logger.info('Audio player buffering');
    });
  }

  async joinChannel(channel: VoiceChannel): Promise<boolean> {
    try {
      this.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator as any,
      });

      await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
      
      this.connection.subscribe(this.audioPlayer);
      
      logger.info(`Joined voice channel: ${channel.name}`);
      return true;
    } catch (error) {
      logger.error('Failed to join voice channel:', error);
      return false;
    }
  }

  async addToQueue(track: Track): Promise<QueueItem> {
    if (this.queue.length >= config.music.maxQueueSize) {
      throw new Error(`Queue is full (max ${config.music.maxQueueSize} tracks)`);
    }

    const queueItem: QueueItem = {
      ...track,
      id: Date.now().toString(),
      addedAt: new Date(),
    };

    this.queue.push(queueItem);
    
    if (!this.currentTrack && this.connection) {
      // Wait a bit to ensure initialization is complete
      setTimeout(() => this.playNext(), 100);
    }

    return queueItem;
  }

  // Wait for the current track to start playing or fail
  async waitForPlaybackStart(timeoutMs: number = 10000): Promise<boolean> {
    if (!this.currentTrack) {
      return false;
    }

    return new Promise((resolve, reject) => {
      this.playbackStartPromise = { resolve, reject };
      
      // Set a timeout in case playback never starts
      setTimeout(() => {
        if (this.playbackStartPromise) {
          this.playbackStartPromise = undefined;
          resolve(false);
        }
      }, timeoutMs);
    });
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      logger.info('Queue is empty, nothing to play');
      return;
    }

    this.currentTrack = this.queue.shift();
    
    if (!this.currentTrack) {
      return;
    }

    try {
      const trackUrl = String(this.currentTrack.url);
      const trackTitle = String(this.currentTrack.title);
      
      logger.info(`Playing: ${trackTitle}`);
      logger.info(`URL: ${trackUrl}`);
      
      let stream;
      let streamType = StreamType.Arbitrary;
      
      // Always extract stream for URLs (YouTube or otherwise)
      stream = await this.getYouTubeStream(trackUrl);
      
      // Create audio resource with volume
      const resource = createAudioResource(stream, {
        inputType: streamType,
        inlineVolume: true,
      });
      
      if (resource.volume) {
        resource.volume.setVolume(this.volume);
      }

      this.audioPlayer.play(resource);
      logger.info('Audio resource sent to player');
    } catch (error: any) {
      const errorMessage = typeof error === 'string' ? error : (error.message || 'Unknown error');
      logger.error('Failed to play track:', { 
        error: errorMessage,
        url: this.currentTrack?.url ? String(this.currentTrack.url) : 'unknown',
        title: this.currentTrack?.title ? String(this.currentTrack.title) : 'unknown'
      });
      
      // Store the error message to potentially notify the user
      if (this.currentTrack) {
        (this.currentTrack as any).error = errorMessage;
      }
      
      // Resolve the playback promise as failed
      if (this.playbackStartPromise) {
        this.playbackStartPromise.resolve(false);
        this.playbackStartPromise = undefined;
      }
      
      this.emit('trackError', this.currentTrack, errorMessage);
      this.playNext();
    }
  }

  private async getYouTubeStream(url: string): Promise<any> {
    // Ensure URL is a string
    const urlString = String(url);
    
    logger.info(`[Player] Starting stream extraction for URL: ${urlString}`);
    
    // Extract and validate video ID
    const videoIdMatch = urlString.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    
    if (!videoId) {
      logger.error(`[Player] Could not extract video ID from URL: ${urlString}`);
      throw new Error('Invalid YouTube URL - could not extract video ID');
    }
    
    logger.info(`[Player] Extracted video ID: ${videoId}`);
    
    // Store errors from each attempt for better error reporting
    const errors: { method: string; error: any }[] = [];
    
    // Enhanced headers for all methods
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cookie': '',
    };
    
    // Method 1: Try yt-dlp first (most reliable with cookie support)
    try {
      logger.info('[Player] Attempting with yt-dlp...');
      
      // Get stream directly from yt-dlp
      const stream = await ytDlpExtractor.getAudioStream(urlString);
      
      logger.info('[Player] Successfully created stream with yt-dlp');
      return stream;
    } catch (ytDlpError: any) {
      errors.push({ method: 'yt-dlp', error: ytDlpError });
      logger.warn('[Player] yt-dlp failed:', {
        error: ytDlpError.message || String(ytDlpError),
        url: urlString
      });
    }
    
    // Method 2: Try play-dl as fallback
    try {
      logger.info('[Player] Attempting with play-dl...');
      
      // Validate with play-dl
      const validated = await play.validate(urlString);
      if (validated !== 'yt_video') {
        throw new Error(`Not a valid YouTube video URL (type: ${validated})`);
      }
      
      // Get video info
      const info = await play.video_info(urlString);
      if (!info || !info.video_details) {
        throw new Error('Could not get video details');
      }
      
      logger.info(`[Player] play-dl found video: ${info.video_details.title}`);
      
      // Create stream
      const stream = await play.stream(urlString, {
        quality: 2, // highest quality
      });
      
      logger.info('[Player] Successfully created stream with play-dl');
      return stream.stream;
    } catch (playError: any) {
      errors.push({ method: 'play-dl', error: playError });
      logger.warn('[Player] play-dl failed:', {
        error: playError.message || String(playError),
        url: urlString
      });
    }
    
    // Method 3: Try ytdl-core as last resort
    try {
      logger.info('[Player] Attempting with ytdl-core...');
      
      if (!ytdl.validateURL(urlString)) {
        throw new Error('Invalid YouTube URL format');
      }
      
      const info = await ytdl.getInfo(urlString, {
        requestOptions: { headers },
      });
      
      if (!info.videoDetails) {
        throw new Error('Video details not available');
      }
      
      logger.info(`[Player] ytdl-core found video: ${info.videoDetails.title}`);
      
      const stream = ytdl.downloadFromInfo(info, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        dlChunkSize: 0,
      });
      
      logger.info('[Player] Successfully created stream with ytdl-core');
      return stream;
    } catch (ytdlError: any) {
      errors.push({ method: 'ytdl-core', error: ytdlError });
      logger.error('[Player] ytdl-core also failed:', {
        error: ytdlError.message || String(ytdlError),
        statusCode: ytdlError.statusCode,
        url: urlString
      });
    }
    
    // All methods failed - analyze errors and provide helpful message
    logger.error('[Player] All extraction methods failed:', {
      url: urlString,
      videoId: videoId,
      attempts: errors.map(e => ({
        method: e.method,
        error: e.error.message || String(e.error),
        statusCode: e.error.statusCode
      }))
    });
    
    // Determine the best error message based on common patterns
    const errorMessages = errors.map(e => e.error.message || '').join(' ');
    
    if (errorMessages.includes('Status code: 410') || errorMessages.includes('410')) {
      throw new Error('This video is not accessible. YouTube has blocked access - the video may be deleted or region-restricted.');
    } else if (errorMessages.includes('Sign in to confirm') || errorMessages.includes('age')) {
      throw new Error('This video requires sign-in (age-restricted content). Try a different video.');
    } else if (errorMessages.includes('private')) {
      throw new Error('This video is private and cannot be played.');
    } else if (errorMessages.includes('unavailable')) {
      throw new Error('This video is unavailable. It may have been removed or made private.');
    } else if (errorMessages.includes('429')) {
      throw new Error('YouTube rate limit reached. Please try again in a few moments.');
    }
    
    // Generic error with all method details
    throw new Error(`Failed to extract audio stream. All methods failed. URL: ${urlString}`);
  }

  pause(): boolean {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
      this.audioPlayer.pause();
      this.isPaused = true;
      return true;
    }
    return false;
  }

  resume(): boolean {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
      this.audioPlayer.unpause();
      this.isPaused = false;
      return true;
    }
    return false;
  }

  skip(): boolean {
    if (this.currentTrack) {
      this.audioPlayer.stop();
      return true;
    }
    return false;
  }

  stop(): void {
    this.queue = [];
    this.currentTrack = undefined;
    this.audioPlayer.stop();
    
    if (this.connection) {
      this.connection.destroy();
      this.connection = undefined;
    }
  }

  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  getCurrentTrack(): QueueItem | undefined {
    return this.currentTrack;
  }

  isPlaying(): boolean {
    return this.audioPlayer.state.status === AudioPlayerStatus.Playing;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume / 100));
    logger.info(`Volume set to ${volume}%`);
  }
}