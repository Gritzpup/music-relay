import axios from 'axios';
import { logger } from '../utils/logger';

export interface LyricsResult {
  title: string;
  artist: string;
  lyrics?: string;
  url?: string;
  thumbnail?: string;
}

export class LyricsService {
  constructor() {
    // You can add a Genius API key to .env for better results
  }

  async searchLyrics(query: string): Promise<LyricsResult | null> {
    try {
      // Clean up the query - remove common YouTube suffixes
      const cleanQuery = query
        .replace(/\(official\s*(video|audio|music video|lyric video)\)/gi, '')
        .replace(/\[official\s*(video|audio|music video|lyric video)\]/gi, '')
        .replace(/official\s*(video|audio|music video|lyric video)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Try searching with a lyrics API
      const searchUrl = `https://some-lyrics-api.herokuapp.com/lyrics?q=${encodeURIComponent(cleanQuery)}`;
      
      try {
        const response = await axios.get(searchUrl, { timeout: 5000 });
        if (response.data && response.data.lyrics) {
          return {
            title: response.data.title || cleanQuery,
            artist: response.data.artist || 'Unknown Artist',
            lyrics: response.data.lyrics,
            url: response.data.url,
            thumbnail: response.data.thumbnail,
          };
        }
      } catch (apiError) {
        logger.warn('Lyrics API failed, using fallback search');
      }

      // Fallback: Generate a Google search link for lyrics
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery + ' lyrics')}`;
      
      return {
        title: cleanQuery,
        artist: 'Search for lyrics',
        url: googleSearchUrl,
      };
    } catch (error) {
      logger.error('Error searching for lyrics:', error);
      return null;
    }
  }

  formatLyricsEmbed(lyrics: LyricsResult, isPlaying: boolean = true): any {
    const embed: any = {
      color: 0x1DB954, // Spotify green color
      title: `🎤 ${lyrics.title}`,
      description: lyrics.artist,
      footer: {
        text: isPlaying ? '♪ Currently playing' : '♪ Last played',
      },
      timestamp: new Date(),
    };

    if (lyrics.url) {
      embed.fields = [
        {
          name: '📝 View Full Lyrics',
          value: `[Click here to see lyrics](${lyrics.url})`,
          inline: false,
        }
      ];
    }

    if (lyrics.lyrics && lyrics.lyrics.length > 0) {
      // Only show a preview (first few lines) to respect copyright
      const lines = lyrics.lyrics.split('\n').filter(line => line.trim());
      const preview = lines.slice(0, 4).join('\n');
      
      if (preview) {
        embed.fields = embed.fields || [];
        embed.fields.unshift({
          name: '🎵 Preview',
          value: preview + (lines.length > 4 ? '\n...' : ''),
          inline: false,
        });
      }
    }

    if (lyrics.thumbnail) {
      embed.thumbnail = { url: lyrics.thumbnail };
    }

    return embed;
  }
}