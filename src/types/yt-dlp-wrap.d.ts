declare module 'yt-dlp-wrap' {
  import { Readable } from 'stream';

  export default class YTDlpWrap {
    constructor(binaryPath?: string);
    
    execPromise(args: string[]): Promise<string>;
    execStream(args: string[]): Readable;
    getVersion(): Promise<string>;
    
    static downloadFromGithub(binaryPath: string): Promise<void>;
  }
}