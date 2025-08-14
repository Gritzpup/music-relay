# YouTube Music Bot

A Discord bot that plays music from YouTube with ad-free playback capabilities.

## Features

- 🎵 Play music from YouTube and YouTube Music
- 🔍 Search by song name or direct YouTube URL
- 📃 Queue management system
- ⏯️ Playback controls (play, pause, resume, skip, stop)
- 🎚️ Volume control
- 🚫 Ad-free playback through audio-only extraction
- 🎤 Lyrics display for sing-along (auto-shows when playing)

## Commands

- `/play [query]` - Play a song or add it to the queue (auto-shows lyrics)
- `/pause` - Pause the current song
- `/resume` - Resume playback
- `/skip` - Skip to the next song
- `/queue` - View the current queue
- `/stop` - Stop playback and clear the queue
- `/lyrics` - Get lyrics for the currently playing song

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Discord bot token
   ```

3. **Run the bot**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

## Configuration

The bot uses the following environment variables:

- `DISCORD_BOT_TOKEN` - Your Discord bot token (required)
- `DISCORD_MUSIC_CHANNEL_ID` - ID of the music channel (optional)
- `DEFAULT_VOLUME` - Default volume level (0-100, default: 50)
- `MAX_QUEUE_SIZE` - Maximum number of tracks in queue (default: 100)
- `LOG_LEVEL` - Logging level (default: info)
- `GENIUS_API_KEY` - Genius API key for better lyrics results (optional)

## Technical Details

The bot uses:
- **discord.js** for Discord API interaction
- **@discordjs/voice** for voice channel support
- **play-dl** and **ytdl-core** for YouTube extraction
- **youtube-sr** for YouTube search functionality

The bot implements ad-free playback by:
- Extracting audio-only streams from YouTube
- Using play-dl for better stream quality
- Falling back to ytdl-core when needed
- Avoiding video streams to skip video ads

## Permissions

The bot requires the following Discord permissions:
- View Channels
- Send Messages
- Connect
- Speak
- Use Voice Activity

## License

ISC