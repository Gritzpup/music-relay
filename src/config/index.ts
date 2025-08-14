import dotenv from 'dotenv';
import { Config } from '../types';

dotenv.config();

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value || defaultValue!;
}

export const config: Config = {
  discord: {
    token: getEnvVar('DISCORD_BOT_TOKEN'),
    musicChannelId: getEnvVar('DISCORD_MUSIC_CHANNEL_ID', '1402670920136527902'),
  },
  music: {
    defaultVolume: parseInt(getEnvVar('DEFAULT_VOLUME', '50')),
    maxQueueSize: parseInt(getEnvVar('MAX_QUEUE_SIZE', '100')),
  },
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
  },
};

export function validateConfig(): void {
  const requiredVars = [
    'DISCORD_BOT_TOKEN',
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}