# Music Relay Bot Setup Guide

## Prerequisites

1. **Discord Bot Token**
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to Bot section and create a bot
   - Copy the token

2. **Telegram Group ID**
   - Run `node scripts/get-ids.js` after setting TELEGRAM_BOT_TOKEN
   - Send a message in your group
   - Note the Chat ID from the output

3. **Falvibot User ID**
   - In Discord, right-click on Falvibot
   - Copy ID (Developer Mode must be enabled)

## Step-by-Step Setup

1. **Clone and Install**
   ```bash
   cd music-relay
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Add Bots to Services**
   
   **Discord:**
   - Use this invite link format: 
     `https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=68608&scope=bot`
   - Permissions needed: Read Messages, View Channels, Read Message History

   **Telegram:**
   - Add @gritzmusicbot to your group
   - Make it admin with permission to send messages

4. **Get IDs**
   ```bash
   # This will show you available channels and group IDs
   node scripts/get-ids.js
   ```

5. **Start the Bot**
   ```bash
   # Development
   npm run dev
   
   # Production
   ./start.sh
   ```

## Verification

1. The bot should log:
   - "Discord bot logged in as [bot name]"
   - "Telegram bot connected as @gritzmusicbot"

2. Test by having Falvibot post a Spotify link in the Discord music channel

3. Check the Telegram music topic for the relayed message

## Troubleshooting

- **Bot not detecting messages:** Ensure Falvibot ID is correct
- **Telegram not receiving:** Check group ID and topic ID
- **Discord errors:** Verify bot has proper permissions in the channel