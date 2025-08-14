import { Guild, VoiceChannel } from 'discord.js';
import { MusicPlayer } from './player';
import { YouTubeService } from './youtube';
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
    
    // Search for track
    const track = await this.youtubeService.search(query);
    
    if (!track) {
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
      const queueItem = await player.addToQueue(track);
      const queueLength = player.getQueue().length;
      
      // Wait a moment to see if the track starts playing or encounters an error
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const currentTrack = player.getCurrentTrack();
      
      if (currentTrack?.id === queueItem.id) {
        // Check if there was an error
        if ((currentTrack as any).error) {
          const errorMsg = (currentTrack as any).error;
          
          // Provide helpful suggestions based on the error
          if (errorMsg.includes('YouTube blocked access') || errorMsg.includes('Sign in to confirm')) {
            return { 
              success: false, 
              message: `❌ YouTube is blocking access to this video.\n\n💡 **Try these alternatives:**\n• Search for a cover or live version\n• Try the artist's topic channel (e.g., "${query} topic")\n• Search for the song on other platforms\n• Try a slightly different search term` 
            };
          }
          
          return { success: false, message: `❌ Failed to play: ${errorMsg}` };
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