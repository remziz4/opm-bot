import fs from 'fs';
import path from 'path';
import { whatsappClient } from "../../../index.js";
import {NFL_TEAM_EMOJIS} from "../../../data/teams/index.js";

const getTeams = () => {
    const filePath = path.join(process.env.TEAM_DATA_LOCATION, 'player_teams.json');
    console.log('reading file from: ', filePath);
    const data = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(data);
    console.log(`read ${Object.keys(obj).length} keys from player_teams.json`);
    return obj;
}

const transformAbbreviatedNames = (teamName) => {
    teamName = teamName.toUpperCase();
    switch (teamName) {
        case 'CARDS': return 'CARDINALS';
        case 'BUCS': return 'BUCCANEERS';
        case 'NINERS': return '49ERS';
        case 'PATS' : return 'PATRIOTS';
        default: return teamName;
    }
}

export default async (message) => {
    const { _data: data } = message;
    if (data.body?.startsWith('!')) {
        console.log('command message received: ', data.body);
        const teamName = transformAbbreviatedNames(data.body.split(' ')[0].substring(1).toUpperCase());
        const teamRecord = getTeams()[teamName];
        if (teamRecord) {
            const teamContact = await whatsappClient.getContactById(teamRecord.id);
            const messageContent = `@${teamContact.id.user} ${NFL_TEAM_EMOJIS[teamName]} (Sent by OPM-Bot 🤖)`;
            message.reply(
                messageContent,
                message['_data'].id.remote,
                { mentions: [teamContact.id['_serialized']]}
            );
        }
    }

};
