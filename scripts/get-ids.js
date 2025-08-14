const TelegramBot = require('node-telegram-bot-api');
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

async function getTelegramInfo() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('TELEGRAM_BOT_TOKEN not set in .env');
    return;
  }

  const bot = new TelegramBot(token, { polling: true });
  
  console.log('\n=== Telegram Bot Info ===');
  const me = await bot.getMe();
  console.log(`Bot Username: @${me.username}`);
  console.log(`Bot ID: ${me.id}`);
  
  console.log('\nListening for messages... Send a message in your group to see the IDs.');
  console.log('Press Ctrl+C to stop.\n');

  bot.on('message', (msg) => {
    console.log('--- New Message ---');
    console.log(`Chat ID: ${msg.chat.id}`);
    console.log(`Chat Title: ${msg.chat.title || 'Private Chat'}`);
    console.log(`Chat Type: ${msg.chat.type}`);
    if (msg.message_thread_id) {
      console.log(`Topic ID: ${msg.message_thread_id}`);
    }
    console.log(`From: ${msg.from.username || msg.from.first_name}`);
    console.log(`Message: ${msg.text?.substring(0, 50)}...`);
    console.log('');
  });
}

async function getDiscordInfo() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.log('DISCORD_BOT_TOKEN not set in .env');
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.once('ready', () => {
    console.log('\n=== Discord Bot Info ===');
    console.log(`Bot Username: ${client.user.tag}`);
    console.log(`Bot ID: ${client.user.id}`);
    
    console.log('\n=== Available Servers ===');
    client.guilds.cache.forEach(guild => {
      console.log(`\nServer: ${guild.name} (${guild.id})`);
      console.log('Text Channels:');
      guild.channels.cache
        .filter(channel => channel.type === 0) // Text channels
        .forEach(channel => {
          console.log(`  - #${channel.name} (${channel.id})`);
        });
    });
    
    setTimeout(() => {
      client.destroy();
      process.exit(0);
    }, 5000);
  });

  client.login(token);
}

// Run both
getTelegramInfo();
getDiscordInfo();