import { sendMessageToRecipients } from '../../../api/whatsapp/index.js';
import { NFL_TEAM_EMOJIS } from '../../../data/teams/index.js';
import { BOT_NOTICE } from "../../../util/constants/index.js";

const getMessageType = (heading) => {
    if (heading.includes('Pending')) {
        return 'PENDING'
    } else if (heading.includes('Approved')) {
        return 'APPROVED'
    } else if (heading.includes('Denied')) {
        return 'DENIED'
    }
}

const getTeamText = (team) => {
    const teamEmoji = NFL_TEAM_EMOJIS[team.toUpperCase()];
    return `${team} ${teamEmoji}`;
}

const constructWhatsAppMessage = (messageDetails) => {
    const { messageType, team1, team2, tradeUrl } = messageDetails;
    let message = '';
    console.log('messageType: ', messageType);
    switch (messageType) {
        case 'PENDING':
            message += `⏳ New Trade between the:
- ${getTeamText(team1)}
- ${getTeamText(team2)}
has been submitted and is *pending review*.`;
            break;

        case 'APPROVED':
            message += `✅ Trade between the:
- ${getTeamText(team1)}
- ${getTeamText(team2)}
has been *approved*! The involved teams can proceed with executing the trade in-game.`;
            break;

        case 'DENIED':
            message += `⛔Trade between the:
- ${getTeamText(team1)}\n
- ${getTeamText(team2)}\n
has been *denied*.`;
    }

    console.log('message before adding URL: ', message);

    message += `\n\nClick here to view details: ${tradeUrl}`;
    message+= BOT_NOTICE;
    return message;
}

export default async (message) => {
    console.log('Message embedded details: ', message.embeds);
    const messageType = getMessageType(message.embeds[0]?.data?.title);

    if (!messageType) {
        return;
    }

    const tradeUrl = message.embeds[0].data.url;
    const team1 = message.embeds[1].data.title.split(' ')[0];
    const team2 = message.embeds[2].data.title.split(' ')[0];

    const messageDetails = {
        messageType,
        team1,
        team2,
        tradeUrl
    };

    const whatsappMessage = constructWhatsAppMessage(messageDetails);
    const messageRecipients = `${process.env.WHATSAPP_TRADE_UPDATE_RECIPIENTS}`.split(',');
    await sendMessageToRecipients(messageRecipients, whatsappMessage);
    console.log(`Sent message to WhatsApp\n: ${whatsappMessage}`);

};