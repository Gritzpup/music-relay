const ffmpegStatic = require('ffmpeg-static');
import { logger } from '../utils/logger';

export function getFFmpegPath(): string | null {
  try {
    if (ffmpegStatic) {
      logger.info(`Using ffmpeg from ffmpeg-static: ${String(ffmpegStatic)}`);
      return String(ffmpegStatic);
    }
  } catch (error) {
    logger.warn('ffmpeg-static not available, using system ffmpeg');
  }
  return null;
}