import fs from 'fs';
import path from 'path';
import { whatsappClient } from "../../../index.js";
import { NFL_TEAM_EMOJIS } from "../../../data/teams/index.js";

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
        case 'CARDS':
        case 'ARZ':
            return 'CARDINALS';
        case 'BUCS':
        case 'TB':
            return 'BUCCANEERS';
        case 'NINERS':
        case 'SF':
            return '49ERS';
        case 'PATS':
        case 'NE':
            return 'PATRIOTS';
        case 'HAWKS':
        case 'SEA':
            return 'SEAHAWKS';
        case 'JAGS':
        case 'JAX':
            return 'JAGUARS';
        case 'ATL':
            return 'FALCONS';
        case 'BAL':
            return 'RAVENS';
        case 'BUF':
            return 'BILLS';
        case 'CAR':
            return 'PANTHERS';
        case 'CHI':
            return 'BEARS';
        case 'CIN':
            return 'BENGALS';
        case 'CLE':
            return 'BROWNS';
        case 'DAL':
            return 'COWBOYS';
        case 'DEN':
            return 'BRONCOS';
        case 'DET':
            return 'LIONS';
        case 'GB':
            return 'PACKERS';
        case 'HOU':
            return 'TEXANS';
        case 'IND':
            return 'COLTS';
        case 'KC':
            return 'CHIEFS';
        case 'LAC':
            return 'CHARGERS';
        case 'LAR':
            return 'RAMS';
        case 'LV':
            return 'RAIDERS';
        case 'MIA':
            return 'DOLPHINS';
        case 'MIN':
            return 'VIKINGS';
        case 'NO':
            return 'SAINTS';
        case 'NYG':
            return 'GIANTS';
        case 'NYJ':
            return 'JETS';
        case 'PHI':
            return 'EAGLES';
        case 'PIT':
            return 'STEELERS';
        case 'TEN':
            return 'TITANS';
        case 'WAS':
            return 'COMMANDERS';
        default: return teamName;
    }
}

export default async (message) => {
    const { _data: data } = message;
    if (data.body?.match(/!\w{2,}/)) {
        const teams = getTeams();
        const teamMentions = [];
        // Split the message into parts, use (\s+) instead of just \s+ to keep the whitespace in the parts array
        const parts = data.body.split(/(\s+)/);
        const processedParts = await Promise.all(parts.map(async (part) => {
            // Only process parts that match the token pattern
            if (part.match(/^!\w{2,}/)) {
                const teamName = transformAbbreviatedNames(part.substring(1).toUpperCase());
                const teamRecord = teams[teamName];
                if (teamRecord) {
                    const teamContact = await whatsappClient.getContactById(teamRecord.id);
                    const messageContent = `@${teamContact.id.user} ${NFL_TEAM_EMOJIS[teamName]}`;
                    teamMentions.push(teamContact.id['_serialized']);
                    return messageContent;
                }
            }
            return part; // Return unchanged whitespace or non-matching parts
        }));
        if (teamMentions.length) {
            const processedMessage = processedParts.join('') + '\n\n(Sent by OPM-Bot 🤖)';
            message.reply(processedMessage, message['_data'].id.remote, { mentions: teamMentions });
        }
    }
};
