import { Client as DiscordClient, GatewayIntentBits } from 'discord.js';
import whatsAppWeb from 'whatsapp-web.js';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import { handleAnnouncement, handleTrade } from './message-handlers/discord/index.js';
import {handleMainChatMessage} from "./message-handlers/whatsapp/index.js";

const { Client: WhatsAppClient, LocalAuth } = whatsAppWeb;

dotenv.config();

/* Discord Configuration */
const discordClient = new DiscordClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const getDiscordChannelIds = () => ({
    announcements: process.env.ANNOUNCEMENT_CHANNEL_ID,
    trades: process.env.TRADE_CHANNEL_ID
});

discordClient.once('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`);
});

discordClient.on('messageCreate', (message) => {
    if (message.author.id === process.env.NEON_BOT_ID) {
        const channelIds = getDiscordChannelIds();
        switch(message.channel.id) {
            case channelIds.announcements:
                handleAnnouncement(message);
                break;
            case channelIds.trades:
                handleTrade(message);
        }
    }
});

const token = process.env.DISCORD_BOT_TOKEN;
discordClient.login(token);

/* WhatsApp Configuration */
export const whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

whatsappClient.on('qr', (qr) => {
    console.log('WhatsApp Web Client QR Code (scan this from whatsapp web to authorize this bot):')
    QRCode.toString(qr, (err, url) => {
        if (err) throw err;
        console.log(url);
    });
});

whatsappClient.on('ready', async () => {
    console.log('Client is ready!');
});

whatsappClient.on('message_create', (message) => {
    if (message['_data'].id.remote === process.env.MAIN_GROUP_ID) {
        handleMainChatMessage(message);
    }
});

console.log('Initializing WhatsApp client...')
whatsappClient.initialize();
