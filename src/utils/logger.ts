import winston from 'winston';
import { config } from '../config';

// Safe stringify function to handle circular references
function safeStringify(obj: any): string {
  const seen = new Set();
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    // Also handle Error objects
    if (value instanceof Error) {
      return {
        message: value.message,
        stack: value.stack,
        name: value.name
      };
    }
    return value;
  });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      try {
        msg += ` ${safeStringify(metadata)}`;
      } catch (error) {
        msg += ` [Metadata stringify error]`;
      }
    }
    return msg;
  })
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: 'music-relay.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

export function logMusicRelay(spotifyUrl: string, platform: 'discord' | 'telegram', metadata?: any): void {
  logger.info(`Music relay: ${platform} → ${platform === 'discord' ? 'telegram' : 'discord'}`, {
    spotifyUrl,
    ...metadata,
  });
}