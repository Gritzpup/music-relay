# Testing Guide for YouTube Music Bot

## Prerequisites

1. **Discord Bot Token**: Ensure your `.env` file has a valid `DISCORD_BOT_TOKEN`
2. **Bot Permissions**: Your bot needs these Discord permissions:
   - View Channels
   - Send Messages
   - Connect
   - Speak
   - Use Voice Activity

## Testing Steps

### 1. Initial Setup
```bash
# Install dependencies
npm install

# Build the project
npm run build

# (Optional) Set up YouTube authentication
node scripts/setup-cookies.js
```

### 2. Run the Bot
```bash
npm run dev
```

On first run:
- yt-dlp binary will be automatically downloaded
- You should see: "Downloading yt-dlp binary..."
- Then: "Discord bot is ready!"

### 3. Test Commands in Discord

#### Basic Search Test
1. Join a voice channel
2. Type `/play` and search for a song (e.g., "never gonna give you up")
3. Select from autocomplete suggestions
4. Bot should:
   - Join your voice channel
   - Show "Processing your request..."
   - Extract audio using yt-dlp
   - Show "Now playing: **[Song Title]**"
   - Actually play audio

#### Direct URL Test
1. Get a YouTube URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
2. Use `/play https://www.youtube.com/watch?v=dQw4w9WgXcQ`
3. Bot should play the video's audio

#### Queue Management Test
1. Play a song
2. While it's playing, add another with `/play [another song]`
3. Use `/queue` to see both tracks
4. Use `/skip` to move to next song
5. Use `/stop` to clear queue

### 4. Expected Logs

Successful playback shows:
```
[MusicManager] Starting play request for query: [your query]
[YouTube] Searching for: [your query]
[YouTube] Found [X] results
[Player] Starting stream extraction for URL: https://youtube.com/...
[Player] Attempting with yt-dlp...
[yt-dlp] Executing yt-dlp for URL: https://youtube.com/...
[Player] Successfully created stream with yt-dlp
Audio player started playing
```

### 5. Common Issues

#### "Sign in to confirm you're not a bot"
- Run `node scripts/setup-cookies.js`
- Export cookies from your browser
- Save as `cookies.txt` in the bot directory

#### No audio but shows "Now playing"
- Check voice channel permissions
- Ensure ffmpeg is installed: `ffmpeg -version`
- Check firewall/network settings

#### yt-dlp download fails
- Manually download from: https://github.com/yt-dlp/yt-dlp/releases
- Place in project root directory
- Make executable: `chmod +x yt-dlp` (Linux/macOS)

### 6. Verify Core Features

- [x] YouTube search with autocomplete
- [x] Direct YouTube URL playback  
- [x] Queue management
- [x] Playback controls (play/pause/skip/stop)
- [x] Error handling with helpful messages
- [x] Cookie-based authentication support
- [x] Automatic yt-dlp binary management

## Debug Commands

Check bot status:
```bash
# View real-time logs
npm run dev

# Check if yt-dlp works standalone
./yt-dlp --version
./yt-dlp -F "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## Success Criteria

The bot is working correctly when:
1. It joins voice channels without errors
2. Search autocomplete shows YouTube results
3. Selected songs actually play audio
4. Queue management works properly
5. No "Unknown interaction" errors
6. Proper error messages for blocked videos