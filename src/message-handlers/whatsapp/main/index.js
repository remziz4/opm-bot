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
        case 'CARDS': return 'CARDINALS';
        case 'BUCS': return 'BUCCANEERS';
        case 'NINERS': return '49ERS';
        case 'PATS': return 'PATRIOTS';
        case 'HAWKS': return 'SEAHAWKS';
        case 'JAGS': return 'JAGUARS';
        case 'ARZ': return 'CARDINALS';
        case 'ATL': return 'FALCONS';
        case 'BAL': return 'RAVENS';
        case 'BUF': return 'BILLS';
        case 'CAR': return 'PANTHERS';
        case 'CHI': return 'BEARS';
        case 'CIN': return 'BENGALS';
        case 'CLE': return 'BROWNS';
        case 'DAL': return 'COWBOYS';
        case 'DEN': return 'BRONCOS';
        case 'DET': return 'LIONS';
        case 'GB': return 'PACKERS';
        case 'HOU': return 'TEXANS';
        case 'IND': return 'COLTS';
        case 'JAX': return 'JAGUARS';
        case 'KC': return 'CHIEFS';
        case 'LAC': return 'CHARGERS';
        case 'LAR': return 'RAMS';
        case 'LV': return 'RAIDERS';
        case 'MIA': return 'DOLPHINS';
        case 'MIN': return 'VIKINGS';
        case 'NE': return 'PATRIOTS';
        case 'NO': return 'SAINTS';
        case 'NYG': return 'GIANTS';
        case 'NYJ': return 'JETS';
        case 'PHI': return 'EAGLES';
        case 'PIT': return 'STEELERS';
        case 'SEA': return 'SEAHAWKS';
        case 'SF': return '49ERS';
        case 'TB': return 'BUCCANEERS';
        case 'TEN': return 'TITANS';
        case 'WAS': return 'COMMANDERS';
        default: return teamName;
    }
}

export default async (message) => {
    const { _data: data } = message;
    if (data.body?.match(/!\w{2,}/)) {
        const matchingTokens = data.body.split(/\s+/).filter(token => token.match(/!\w{2,}/));
        if (!matchingTokens.length) return;
        const teams = getTeams();
        const teamMessageContents = [];
        const teamMentions = [];
        for (const token of matchingTokens) {
            const teamName = transformAbbreviatedNames(token.substring(1).toUpperCase());
            const teamRecord = teams[teamName];
            if (teamRecord) {
                const teamContact = await whatsappClient.getContactById(teamRecord.id);
                const messageContent = `@${teamContact.id.user} ${NFL_TEAM_EMOJIS[teamName]}`;
                teamMentions.push(teamContact.id['_serialized']);
                teamMessageContents.push(messageContent);
            }
        }
        if (teamMessageContents.length) {
            const fullMessageContent = teamMessageContents.join('\n') + '\n\n(Sent by OPM-Bot 🤖)';
            message.reply(fullMessageContent, message['_data'].id.remote, { mentions: teamMentions });
        }
    }
};
