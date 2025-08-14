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

export class MusicPlayer {
  private audioPlayer: AudioPlayer;
  private connection?: VoiceConnection;
  private queue: QueueItem[] = [];
  private currentTrack?: QueueItem;
  private isPaused: boolean = false;
  private volume: number;
  constructor() {
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
      logger.info(`Playing: ${String(this.currentTrack.title)}`);
      logger.info(`URL: ${String(this.currentTrack.url)}`);
      
      let stream;
      let streamType = StreamType.Arbitrary;
      
      // Check if URL needs stream extraction
      if (this.currentTrack.url.includes('youtube.com') || this.currentTrack.url.includes('youtu.be')) {
        stream = await this.getYouTubeStream(this.currentTrack.url);
      } else {
        // Use URL directly if it's already a stream URL
        stream = this.currentTrack.url;
      }
      
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
      logger.error('Failed to play track:', error.message || error);
      logger.error(`Track URL was: ${String(this.currentTrack?.url)}`);
      logger.error(`Track title was: ${String(this.currentTrack?.title)}`);
      
      // Store the error message to potentially notify the user
      if (this.currentTrack) {
        (this.currentTrack as any).error = error.message;
      }
      
      this.playNext();
    }
  }

  private async getYouTubeStream(url: string): Promise<any> {
    // Extract video ID
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Method 1: Try ytdl-core first
    try {
      logger.info('Trying ytdl-core for video ID:', videoId);
      
      // First validate the URL
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
      }
      
      // Get video info first to check availability
      const info = await ytdl.getInfo(url, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cookie': '',
          },
        },
      });
      
      // Check if video is available
      if (!info.videoDetails) {
        throw new Error('Video details not available');
      }
      
      logger.info(`Found video with ytdl-core: ${info.videoDetails.title}`);
      
      // Create the stream with enhanced options
      const stream = ytdl.downloadFromInfo(info, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        dlChunkSize: 0,
      });
      
      logger.info('Created audio stream with ytdl-core');
      return stream;
    } catch (ytdlError: any) {
      logger.warn('ytdl-core failed:', ytdlError.message || ytdlError);
      
      // Method 2: Try play-dl as fallback
      try {
        logger.info('Trying play-dl as fallback...');
        
        // Validate with play-dl
        const validated = await play.validate(url);
        if (validated !== 'yt_video') {
          throw new Error('Not a valid YouTube video URL');
        }
        
        // Get video info
        const info = await play.video_info(url);
        if (!info || !info.video_details) {
          throw new Error('Could not get video details');
        }
        
        logger.info(`Found video with play-dl: ${info.video_details.title}`);
        
        // Create stream
        const stream = await play.stream(url, {
          quality: 2, // 0 = 144p, 1 = 360p, 2 = 720p/highest
        });
        
        logger.info('Created audio stream with play-dl');
        return stream.stream;
      } catch (playError: any) {
        logger.error('play-dl also failed:', playError.message || playError);
        
        // Determine the best error message
        if (ytdlError.message?.includes('Status code: 410') || playError.message?.includes('410')) {
          throw new Error('This video is not accessible (YouTube blocked access)');
        } else if (ytdlError.message?.includes('Sign in to confirm')) {
          throw new Error('This video requires sign-in (age-restricted or private)');
        } else if (ytdlError.message?.includes('private video')) {
          throw new Error('This video is private');
        } else if (ytdlError.message?.includes('Video unavailable')) {
          throw new Error('This video is unavailable');
        }
        
        throw new Error(`Failed to play video: ${ytdlError.message || playError.message || 'Unknown error'}`);
      }
    }
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