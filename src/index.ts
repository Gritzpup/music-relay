import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import { DiscordMusicBot } from './services/discord';
import { getFFmpegPath } from './config/ffmpeg';

let musicBot: DiscordMusicBot;

async function start() {
  try {
    logger.info('Starting Discord Music Bot...');
    
    // Log ffmpeg path
    const ffmpegPath = getFFmpegPath();
    if (ffmpegPath) {
      logger.info(`FFmpeg available at: ${ffmpegPath}`);
    }
    
    // Validate configuration
    validateConfig();
    
    // Create and start Discord bot
    musicBot = new DiscordMusicBot();
    await musicBot.start();
    
    logger.info('Discord Music Bot is running!');
    logger.info(`Music channel: ${config.discord.musicChannelId}`);
    logger.info('Ready to play music from YouTube!');
    
    // Handle graceful shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('unhandledRejection', (error) => {
      logger.error('Unhandled rejection:', error);
    });
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown();
    });
  } catch (error) {
    logger.error('Failed to start Discord Music Bot:', error);
    process.exit(1);
  }
}

async function shutdown() {
  logger.info('Shutting down Discord Music Bot...');
  
  if (musicBot) {
    try {
      await musicBot.stop();
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
  
  process.exit(0);
}

// Start the bot
start();