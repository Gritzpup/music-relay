import { Client, GatewayIntentBits, REST, Routes, CommandInteraction, GuildMember, AutocompleteInteraction, VoiceChannel } from 'discord.js';
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
        if (interaction.isCommand()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'An error occurred while processing your command.', ephemeral: true });
          } else {
            await interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
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
        // Check if user is in a voice channel
        if (!member.voice.channel) {
          await interaction.reply({ content: '❌ You need to be in a voice channel!', ephemeral: true });
          return;
        }

        const query = (interaction as any).options.get('query')?.value as string;
        logger.info(`[Discord] Play command received with query: ${query}`);
        logger.info(`[Discord] Query type: ${query.includes('youtube.com') || query.includes('youtu.be') ? 'YouTube URL' : 'Search term'}`);
        
        // Defer reply as searching might take time
        await interaction.deferReply();
        
        // Send initial progress message
        await interaction.editReply('🔍 Searching for your song...');
        
        // Update progress
        await interaction.editReply('🎧 Loading audio stream...');
        
        logger.info(`[Discord] Passing to music manager: ${query}`);
        const result = await this.musicManager.play(
          interaction.guild!,
          member.voice.channel as VoiceChannel,
          query,
          member.user.tag
        );
        
        await interaction.editReply(result.message);
        
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
    logger.info(`Autocomplete triggered for: "${focusedValue}"`);
    
    if (interaction.commandName === 'play') {
      try {
        // Check if the interaction is still valid
        if (!interaction || !interaction.respond) {
          logger.warn('Invalid autocomplete interaction');
          return;
        }

        if (!focusedValue || focusedValue.length < 2) {
          await interaction.respond([]);
          return;
        }

        // Search YouTube for suggestions with timeout
        logger.info(`Searching YouTube for: ${focusedValue}`);
        const searchPromise = YouTube.search(focusedValue, { limit: 5, type: 'video' });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), 2500)
        );
        
        const results = await Promise.race([searchPromise, timeoutPromise]) as any[];
        logger.info(`Found ${results.length} results`);
        
        // Log first result structure for debugging
        if (results.length > 0) {
          logger.info('First result structure:', {
            title: results[0].title,
            url: results[0].url,
            link: results[0].link,
            id: results[0].id,
            keys: Object.keys(results[0])
          });
        }
        
        const choices = results.map((video: any) => {
          const url = video.url || video.link || `https://www.youtube.com/watch?v=${video.id}`;
          logger.debug(`[Discord] Autocomplete mapping - Title: ${video.title}, URL: ${url}`);
          return {
            name: video.title && video.title.length > 100 ? video.title.substring(0, 97) + '...' : (video.title || 'Unknown'),
            value: url,
          };
        });
        
        logger.info(`[Discord] Sending ${choices.length} autocomplete choices`);
        choices.forEach((choice, index) => {
          logger.info(`[Discord] Choice ${index + 1}: ${choice.name} -> ${choice.value}`);
        });
        await interaction.respond(choices);
      } catch (error: any) {
        logger.error('Autocomplete error:', {
          message: error?.message || 'Unknown error',
          stack: error?.stack,
          name: error?.name,
          code: error?.code
        });
        try {
          if (interaction && interaction.respond) {
            await interaction.respond([]);
          }
        } catch (respondError: any) {
          logger.error('Failed to respond to autocomplete:', respondError?.message || respondError);
        }
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