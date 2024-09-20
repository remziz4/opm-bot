import { Client, GatewayIntentBits } from 'discord.js';
import { handleAnnouncement, handleTrade } from './message-handlers/index.js';
import dotenv from 'dotenv';

dotenv.config();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const getChannelIds = () => ({
    announcements: process.env.ANNOUNCEMENT_CHANNEL_ID,
    trades: process.env.TRADE_CHANNEL_ID
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', (message) => {
    if (message.author.id === process.env.NEON_BOT_ID) {
        const channelIds = getChannelIds();
        switch(message.channel.id) {
            case channelIds.announcements:
                handleAnnouncement(message);
                break;
            case channelIds.trades:
                handleTrade(message);
        }
    }
});

// Log in to Discord using the bot token from your .env file
const token = process.env.DISCORD_BOT_TOKEN;
console.log('Logging in with token: ', token);
client.login(token);