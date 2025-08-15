import { Guild, VoiceChannel } from 'discord.js';
import { MusicPlayer } from './player';
import { YouTubeService } from './youtube';
import { logger } from '../utils/logger';
// imports cleaned up

export class MusicManager {
  private players: Map<string, MusicPlayer> = new Map();
  private youtubeService: YouTubeService;

  constructor() {
    this.youtubeService = new YouTubeService();
  }

  getPlayer(guildId: string): MusicPlayer {
    let player = this.players.get(guildId);
    
    if (!player) {
      player = new MusicPlayer();
      this.players.set(guildId, player);
    }
    
    return player;
  }

  async play(guild: Guild, channel: VoiceChannel, query: string, requestedBy: string): Promise<{ success: boolean; message: string }> {
    const player = this.getPlayer(guild.id);
    
    logger.info(`[MusicManager] Starting play request for query: ${query}`);
    
    // Search for track
    const track = await this.youtubeService.search(query);
    
    if (!track) {
      // Check if it was a YouTube URL that failed extraction
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        const errorMessage = '❌ Failed to extract audio from YouTube URL.\n\n**YouTube is currently blocking extraction.**\n\n💡 **Try these alternatives:**\n• Search by song name instead of using the URL\n• Try: artist name + song title\n• Use the autocomplete suggestions';
        logger.info(`[MusicManager] Returning YouTube extraction error to user for URL: ${query}`);
        return { 
          success: false, 
          message: errorMessage
        };
      }
      logger.info(`[MusicManager] No results found for search query: ${query}`);
      return { success: false, message: '❌ No results found for your query.' };
    }
    
    // Set who requested the track
    track.requestedBy = requestedBy;
    
    // Join voice channel if not already connected
    const joined = await player.joinChannel(channel);
    
    if (!joined) {
      return { success: false, message: '❌ Failed to join voice channel.' };
    }
    
    // Add to queue (the player will handle getting the stream when it's time to play)
    try {
      // Check if this will be the first track (before adding)
      const isFirstTrack = !player.getCurrentTrack() && player.getQueue().length === 0;
      
      await player.addToQueue(track);
      const queueLength = player.getQueue().length;
      
      // If this is the first track, wait for it to actually start playing
      if (isFirstTrack) {
        logger.info(`[MusicManager] Waiting for playback to start for: ${track.title}`);
        const started = await player.waitForPlaybackStart(15000); // Wait up to 15 seconds
        
        if (!started) {
          // Check if there was an error
          const errorTrack = player.getCurrentTrack();
          if (errorTrack && (errorTrack as any).error) {
            const errorMsg = (errorTrack as any).error;
            
            // Provide helpful suggestions based on the error
            if (errorMsg.includes('YouTube blocked access') || errorMsg.includes('Sign in to confirm') || errorMsg.includes('bot')) {
              return { 
                success: false, 
                message: `❌ YouTube is blocking access to this video.\n\n**${errorMsg}**\n\n💡 **Try these alternatives:**\n• Run \`node scripts/setup-cookies.js\` for cookie setup instructions\n• Search for a different version of the song\n• Try the artist's topic channel (e.g., "${query} topic")\n• Use a slightly different search term` 
              };
            }
            
            return { success: false, message: `❌ Failed to play: ${String(errorMsg)}` };
          }
          
          return { success: false, message: '❌ Failed to start playback. Please try again.' };
        }
        
        return { success: true, message: `🎵 Now playing: **${track.title}**\n🔗 <${track.url}>` };
      } else {
        return { success: true, message: `✅ Added to queue: **${track.title}** (Position: ${queueLength})` };
      }
    } catch (error: any) {
      return { success: false, message: `❌ ${error.message}` };
    }
  }

  pause(guildId: string): { success: boolean; message: string } {
    const player = this.players.get(guildId);
    
    if (!player || !player.isPlaying()) {
      return { success: false, message: '❌ Nothing is playing right now.' };
    }
    
    const paused = player.pause();
    return paused 
      ? { success: true, message: '⏸️ Paused the music.' }
      : { success: false, message: '❌ Failed to pause.' };
  }

  resume(guildId: string): { success: boolean; message: string } {
    const player = this.players.get(guildId);
    
    if (!player || !player.isPausedState()) {
      return { success: false, message: '❌ Music is not paused.' };
    }
    
    const resumed = player.resume();
    return resumed 
      ? { success: true, message: '▶️ Resumed the music.' }
      : { success: false, message: '❌ Failed to resume.' };
  }

  skip(guildId: string): { success: boolean; message: string } {
    const player = this.players.get(guildId);
    
    if (!player || !player.getCurrentTrack()) {
      return { success: false, message: '❌ Nothing is playing right now.' };
    }
    
    const skipped = player.skip();
    return skipped 
      ? { success: true, message: '⏭️ Skipped the current track.' }
      : { success: false, message: '❌ Failed to skip.' };
  }

  stop(guildId: string): { success: boolean; message: string } {
    const player = this.players.get(guildId);
    
    if (!player) {
      return { success: false, message: '❌ No music player is active.' };
    }
    
    player.stop();
    this.players.delete(guildId);
    
    return { success: true, message: '⏹️ Stopped the music and cleared the queue.' };
  }

  getQueue(guildId: string): { currentTrack?: any; queue: any[] } {
    const player = this.players.get(guildId);
    
    if (!player) {
      return { queue: [] };
    }
    
    return {
      currentTrack: player.getCurrentTrack(),
      queue: player.getQueue(),
    };
  }

  getYouTubeService(): YouTubeService {
    return this.youtubeService;
  }
}