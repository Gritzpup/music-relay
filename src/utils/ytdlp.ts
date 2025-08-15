import YTDlpWrap from 'yt-dlp-wrap';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

export class YtDlpExtractor {
  private ytDlpWrap: YTDlpWrap;
  private cookiesPath?: string;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize with local binary path
    const binaryPath = path.join(process.cwd(), 'yt-dlp');
    this.ytDlpWrap = new YTDlpWrap(binaryPath);
    
    // Check for cookies file
    const cookiesFile = path.join(process.cwd(), 'cookies.txt');
    if (fs.existsSync(cookiesFile)) {
      this.cookiesPath = cookiesFile;
      logger.info('[YtDlp] Found cookies.txt file for authentication');
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Check if binary exists, if not download it
      const binaryPath = path.join(process.cwd(), 'yt-dlp');
      if (!fs.existsSync(binaryPath)) {
        logger.info('[YtDlp] Downloading yt-dlp binary...');
        await YTDlpWrap.downloadFromGithub(binaryPath);
        logger.info('[YtDlp] yt-dlp binary downloaded successfully');
        
        // Make it executable on Unix systems
        if (process.platform !== 'win32') {
          fs.chmodSync(binaryPath, '755');
        }
      }
      
      // Get version to verify it works
      const version = await this.ytDlpWrap.getVersion();
      logger.info(`[YtDlp] Initialized with version: ${version}`);
      this.isInitialized = true;
    } catch (error) {
      logger.error('[YtDlp] Failed to initialize:', error);
      throw error;
    }
  }

  async getVideoInfo(url: string): Promise<any> {
    await this.initialize();
    
    const args = [
      url,
      '--dump-json',
      '--no-warnings',
      '--no-playlist',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];

    // Add cookies if available
    if (this.cookiesPath) {
      args.push('--cookies', this.cookiesPath);
    }

    try {
      logger.info(`[YtDlp] Getting video info for: ${url}`);
      const output = await this.ytDlpWrap.execPromise(args);
      const info = JSON.parse(output);
      
      logger.info(`[YtDlp] Successfully got info: ${info.title}`);
      return info;
    } catch (error: any) {
      logger.error('[YtDlp] Failed to get video info:', {
        error: error.message || String(error),
        stderr: error.stderr,
        url: String(url)
      });
      throw error;
    }
  }

  async getAudioStream(url: string): Promise<Readable> {
    await this.initialize();
    
    const args = [
      url,
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',
      '--no-warnings',
      '--no-playlist',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '-o', '-', // Output to stdout
    ];

    // Add cookies if available
    if (this.cookiesPath) {
      args.push('--cookies', this.cookiesPath);
    }

    try {
      logger.info(`[YtDlp] Starting audio stream extraction for: ${url}`);
      const stream = this.ytDlpWrap.execStream(args);
      
      // Handle stream errors
      stream.on('error', (error: any) => {
        const errorMessage = typeof error === 'string' ? error : (error.message || String(error));
        logger.error('[YtDlp] Stream error:', errorMessage);
      });
      
      // Log progress
      stream.on('ytDlpEvent', (eventType: string, eventData: string) => {
        if (eventType === 'download' && eventData.includes('%')) {
          logger.debug(`[YtDlp] Download progress: ${eventData}`);
        }
      });
      
      logger.info('[YtDlp] Audio stream created successfully');
      return stream;
    } catch (error: any) {
      logger.error('[YtDlp] Failed to create audio stream:', {
        error: error.message || String(error),
        stderr: error.stderr,
        url: String(url)
      });
      throw error;
    }
  }

  // Helper method to create/update cookies file
  static saveCookies(cookiesContent: string): void {
    const cookiesPath = path.join(process.cwd(), 'cookies.txt');
    fs.writeFileSync(cookiesPath, cookiesContent);
    logger.info('[YtDlp] Cookies saved to cookies.txt');
  }
}

// Singleton instance
export const ytDlpExtractor = new YtDlpExtractor();