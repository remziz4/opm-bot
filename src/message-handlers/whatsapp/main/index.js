import fs from 'fs';
import path from 'path';
import { whatsappClient } from "../../../index.js";

const getTeams = () => {
    const filePath = path.join(process.env.TEAM_DATA_LOCATION, 'player_teams.json');
    console.log('reading file from: ', filePath);
    const data = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(data);
    console.log(`read ${Object.keys(obj).length} keys from player_teams.json`);
    return obj;
}

export default async (message) => {
    const { _data: data } = message;
    if (data.body?.startsWith('!')) {
        console.log('command message received: ', data.body);
        const teamName = data.body.split(' ')[0].substring(1).toUpperCase();
        const teamRecord = getTeams()[teamName];
        if (teamRecord) {
            const teamContact = await whatsappClient.getContactById(teamRecord.id);
            const messageContent = `@${teamContact.id.user} (Sent by OPM-Bot 🤖)`;
            message.reply(
                messageContent,
                message.to,
                { mentions: [teamContact.id['_serialized']]}
            );
        }
    }

};
