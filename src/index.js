import { Client as DiscordClient, GatewayIntentBits } from 'discord.js';
import express from 'express';
import dotenv from 'dotenv';
import wahaClient from './api/whatsapp/index.js';
// import { handleAnnouncement, handleTrade } from './message-handlers/discord/index.js';
import { handleMainChatMessage } from "./message-handlers/whatsapp/index.js";

const app = express();
app.use(express.json());

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
    console.log(`Authenticated to Discord as ${discordClient.user.tag}!`);
});

discordClient.on('messageCreate', (message) => {
    if (message.author.id === process.env.NEON_BOT_ID) {
        const channelIds = getDiscordChannelIds();
        switch(message.channel.id) {
            case channelIds.announcements:
                //handleAnnouncement(message);
                break;
            case channelIds.trades:
                //handleTrade(message);
        }
    }
});

const token = process.env.DISCORD_BOT_TOKEN;
discordClient.login(token);

app.post("/message", async (req, res) => {
    try {
        const payload = req.body.payload['_data'];
        if (payload['Info']['Type'] === 'text') {
            const parsedMessage = await extractMessageInfoFromPayload(payload);
            if (parsedMessage.chatId === process.env.MAIN_GROUP_ID) {
                await handleMainChatMessage(parsedMessage);
            }
        }
        res.send("OK");
    } catch (err) {
        console.error('Error processing webhook message: ', err);
        console.info('Erroneous message payload: ', JSON.stringify(req.body.payload, null, 2));
    }
});

app.listen(4000, () => console.log("Waha webhook listener is running on port 4000"));

const extractMessageInfoFromPayload = async ({
    Info: { AddressingMode, Chat, ID, Sender, SenderAlt },
    Message: { conversation, extendedTextMessage }
}) => {

    let senderId;
    if (AddressingMode !== 'lid') {
        console.log('AddressingMode is not lid, using Sender or SenderAlt directly');
        senderId = Sender;
    } else if (SenderAlt.endsWith('@s.whatsapp.net') || SenderAlt.endsWith('@c.us')) {
        console.log('AddressingMode is lid, but SenderAlt is a phone number, using SenderAlt');
        senderId = SenderAlt;
    } else {
        console.log('Using API to fetch phone number from lid');
        senderId = await wahaClient.getPnFromLid(Sender)
    }

    if (senderId.endsWith('@s.whatsapp.net')) {
        senderId = senderId.replace('@s.whatsapp.net', '@c.us');
    }

    return {
        chatId: Chat,
        message: {
            content: conversation ? conversation : extendedTextMessage.text,
            id: ID,
        },
        senderId
    }
};
