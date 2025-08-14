import { Client, GatewayIntentBits, REST, Routes, CommandInteraction, GuildMember, AutocompleteInteraction, VoiceChannel, MessageFlags } from 'discord.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { MusicManager } from './musicManager';
import { formatQueue } from '../utils/queue';
import { LyricsService } from './lyrics';
const YouTube = require('youtube-sr').default;

export class DiscordMusicBot {
  private client: Client;
  private isConnected: boolean = false;
  private musicManager: MusicManager;
  private lyricsService: LyricsService;
  private autocompleteCache = new Map<string, { results: any[], timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });

    this.musicManager = new MusicManager();
    this.lyricsService = new LyricsService();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', async () => {
      logger.info(`Discord bot logged in as ${this.client.user?.tag}`);
      this.isConnected = true;
      
      // Register slash commands
      await this.registerCommands();
    });

    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isAutocomplete()) {
          await this.handleAutocomplete(interaction);
        } else if (interaction.isCommand()) {
          await this.handleCommand(interaction as CommandInteraction);
        }
      } catch (error) {
        logger.error('Error handling interaction:', error);
        if (interaction.isCommand() && !interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({ content: 'An error occurred while processing your command.', flags: MessageFlags.Ephemeral });
          } catch (replyError) {
            logger.debug('[Discord] Could not reply to failed interaction:', replyError);
          }
        }
      }
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });

    this.client.on('disconnect', () => {
      logger.warn('Discord client disconnected');
      this.isConnected = false;
    });
  }

  private async handleCommand(interaction: CommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    
    switch (interaction.commandName) {
      case 'play': {
        try {
          // Defer immediately to prevent timeout
          await interaction.deferReply();
          
          // Check if user is in a voice channel
          if (!member.voice.channel) {
            await this.safeEditReply(interaction, '❌ You need to be in a voice channel!');
            return;
          }

          const query = (interaction as any).options.get('query')?.value as string;
          logger.info(`[Discord] Play command received with query: ${query}`);
          logger.info(`[Discord] Query type: ${query.includes('youtube.com') || query.includes('youtu.be') ? 'YouTube URL' : 'Search term'}`);
          
          // Send initial progress message
          await this.safeEditReply(interaction, '🔍 Searching for your song...');
          
          logger.info(`[Discord] Passing to music manager: ${query}`);
          const result = await this.musicManager.play(
            interaction.guild!,
            member.voice.channel as VoiceChannel,
            query,
            member.user.tag
          );
          
          await this.safeEditReply(interaction, result.message);
          
          // If successfully playing, show lyrics
          if (result.success && result.message.includes('Now playing')) {
            try {
              const lyrics = await this.lyricsService.searchLyrics(query);
              if (lyrics) {
                const embed = this.lyricsService.formatLyricsEmbed(lyrics, true);
                await interaction.followUp({ embeds: [embed] });
              }
            } catch (error) {
              logger.warn('Failed to fetch lyrics:', error);
            }
          }
        } catch (error: any) {
          logger.error('[Discord] Play command error:', error);
          if (!interaction.deferred && !interaction.replied) {
            try {
              await interaction.reply({ content: '❌ An error occurred while processing your request.', flags: MessageFlags.Ephemeral });
            } catch {
              // Ignore if we can't reply
            }
          } else {
            await this.safeEditReply(interaction, '❌ An error occurred while processing your request.');
          }
        }
        break;
      }

      case 'stop': {
        const result = this.musicManager.stop(interaction.guildId!);
        await interaction.reply(result.message);
        break;
      }

      case 'skip': {
        const result = this.musicManager.skip(interaction.guildId!);
        await interaction.reply(result.message);
        break;
      }

      case 'queue': {
        const { currentTrack, queue } = this.musicManager.getQueue(interaction.guildId!);
        const queueString = formatQueue(queue, currentTrack);
        await interaction.reply(queueString);
        break;
      }

      case 'pause': {
        const result = this.musicManager.pause(interaction.guildId!);
        await interaction.reply(result.message);
        break;
      }

      case 'resume': {
        const result = this.musicManager.resume(interaction.guildId!);
        await interaction.reply(result.message);
        break;
      }

      case 'lyrics': {
        await interaction.deferReply();
        
        const { currentTrack } = this.musicManager.getQueue(interaction.guildId!);
        
        if (!currentTrack) {
          await interaction.editReply('❌ No song is currently playing.');
          return;
        }
        
        const lyrics = await this.lyricsService.searchLyrics(currentTrack.title);
        
        if (!lyrics) {
          await interaction.editReply('❌ Could not find lyrics for this song.');
          return;
        }
        
        const embed = this.lyricsService.formatLyricsEmbed(lyrics, true);
        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused();
    
    if (interaction.commandName === 'play') {
      try {
        // Return empty for short queries
        if (!focusedValue || focusedValue.length < 2) {
          await interaction.respond([]);
          return;
        }

        // Check cache first
        const cached = this.autocompleteCache.get(focusedValue.toLowerCase());
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
          logger.debug(`[Discord] Using cached results for: "${focusedValue}"`);
          await interaction.respond(cached.results);
          return;
        }

        // Perform search immediately (no debouncing for autocomplete)
        try {
          logger.info(`[Discord] Searching YouTube for: "${focusedValue}"`);
          
          // Search with timeout
          const searchPromise = YouTube.search(focusedValue, { limit: 5, type: 'video' });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Search timeout')), 2500)
          );
          
          const results = await Promise.race([searchPromise, timeoutPromise]) as any[];
          logger.info(`[Discord] YouTube search completed, found ${results?.length || 0} results`);
          
          if (!results || results.length === 0) {
            logger.warn(`[Discord] No results found for: "${focusedValue}"`);
            await interaction.respond([]);
            return;
          }
          
          const choices = results.map((video: any, index: number) => {
            const url = video.url || video.link || `https://www.youtube.com/watch?v=${video.id}`;
            logger.debug(`[Discord] Result ${index + 1}: ${video.title} -> ${url}`);
            return {
              name: video.title && video.title.length > 100 
                ? video.title.substring(0, 97) + '...' 
                : (video.title || 'Unknown'),
              value: url,
            };
          });

          // Cache the results
          this.autocompleteCache.set(focusedValue.toLowerCase(), {
            results: choices,
            timestamp: Date.now()
          });

          // Clean old cache entries
          this.cleanCache();

          logger.info(`[Discord] Sending ${choices.length} autocomplete choices to user`);
          await interaction.respond(choices);
        } catch (searchError: any) {
          logger.error('[Discord] Autocomplete search failed:', {
            error: searchError.message || String(searchError),
            stack: searchError.stack,
            query: focusedValue
          });
          
          // Try to respond with empty array on error
          try {
            await interaction.respond([]);
          } catch {
            // Interaction already responded or timed out
          }
        }
      } catch (error: any) {
        logger.error('[Discord] Autocomplete error:', error);
        try {
          await interaction.respond([]);
        } catch {
          // Interaction already responded or timed out
        }
      }
    }
  }


  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.autocompleteCache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.autocompleteCache.delete(key);
      }
    }
  }

  private async safeEditReply(interaction: CommandInteraction, content: string): Promise<void> {
    try {
      await interaction.editReply(content);
    } catch (error: any) {
      // Silently handle errors - interaction might have timed out
      if (error.code !== 10062) {
        logger.debug('[Discord] Failed to edit reply:', error.message);
      }
    }
  }

  private async registerCommands(): Promise<void> {
    const commands = [
      {
        name: 'play',
        description: 'Play a song from YouTube Music or YouTube',
        options: [{
          name: 'query',
          type: 3, // STRING
          description: 'Song name or YouTube URL',
          required: true,
          autocomplete: true,
        }],
      },
      {
        name: 'stop',
        description: 'Stop music and disconnect from voice channel',
      },
      {
        name: 'skip',
        description: 'Skip the current song',
      },
      {
        name: 'queue',
        description: 'Show the current music queue',
      },
      {
        name: 'pause',
        description: 'Pause the current song',
      },
      {
        name: 'resume',
        description: 'Resume the paused song',
      },
      {
        name: 'lyrics',
        description: 'Get lyrics for the currently playing song',
      },
    ];

    try {
      const rest = new REST({ version: '10' }).setToken(config.discord.token);
      
      logger.info('Registering slash commands...');
      
      await rest.put(
        Routes.applicationCommands(this.client.user!.id),
        { body: commands },
      );
      
      logger.info('Successfully registered slash commands');
    } catch (error) {
      logger.error('Failed to register slash commands:', error);
    }
  }

  async start(): Promise<void> {
    try {
      await this.client.login(config.discord.token);
      logger.info('Discord service connecting...');
    } catch (error) {
      logger.error('Failed to connect to Discord:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.client.destroy();
    this.isConnected = false;
    logger.info('Discord service disconnected');
  }

  getStatus(): { connected: boolean } {
    return { connected: this.isConnected };
  }
}