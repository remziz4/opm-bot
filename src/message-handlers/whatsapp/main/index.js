import fs from 'fs';
import path from 'path';
import { whatsappClient } from "../../../index.js";
import neonClient from "../../../api/neonsportz/index.js";
import {NFL_TEAM_CITY_ABBREVIATIONS, NFL_TEAM_EMOJIS, teamAliases} from "../../../data/teams/index.js";
import {wrapInMonospace} from "../../../util/string/index.js";

const SENT_BY_OPM_BOT_TAG = '(Sent by OPM-Bot 🤖)';

const COMMANDS = ['opponent', 'remaining', 'schedule', 'standings', 'week'];

const getPlayerTeams = () => {
    const filePath = path.join(process.env.TEAM_DATA_LOCATION, 'player_teams.json');
    console.log('reading file from: ', filePath);
    const data = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(data);
    console.log(`read ${Object.keys(obj).length} keys from player_teams.json`);
    return obj;
}

const detectMessageType = (msg) => {
    const trimmedMsg = msg.trim();

    const startingToken = trimmedMsg.match(/^!(\S+)/)?.[1];
    const hasTokens = /!\S+/.test(trimmedMsg);

    if (startingToken) {
        if (teamAliases.has(startingToken.toUpperCase())) {
            if (trimmedMsg === `!${startingToken}`) {
                return 'team-lookup';
            }
            return 'embedded';
        } else if (COMMANDS.includes(startingToken.toLowerCase())) {
            return startingToken.toLowerCase();
        } else {
            return 'invalid';
        }
    } else if (hasTokens) {
        return 'embedded';
    }

    return 'standard';
};

const processTeamLookupRequest = async (message) => {
    const { _data: data } = message;
    const teamName = teamAliases.get(data.body.substring(1).toUpperCase());
    const playerTeamRecord = getPlayerTeams()[teamName];
    if (playerTeamRecord) {
        const teamContact = await whatsappClient.getContactById(playerTeamRecord.id);
        const messageContent = `${wrapInMonospace(`@${teamContact.id.user} ${NFL_TEAM_EMOJIS[teamName]}`)}\n${SENT_BY_OPM_BOT_TAG}`;
        message.reply(
            messageContent,
            message['_data'].id.remote,
            { mentions: [teamContact.id['_serialized']]}
        );
    }
}

const processEmbeddedMessage = async (message) => {
    const { _data: data } = message;
    const playerTeams = getPlayerTeams();
    const teamMentions = [];

    const parts = data.body.split(/(\s+)/);
    const processedParts = await Promise.all(parts.map(async (part) => {
        if (part.match(/^!\w{2,}/)) {
            const teamName = teamAliases.get(part.substring(1).toUpperCase());
            const teamRecord = playerTeams[teamName];
            if (teamRecord) {
                const teamContact = await whatsappClient.getContactById(teamRecord.id);
                const mention = `@${teamContact.id.user} ${NFL_TEAM_EMOJIS[teamName]}`;
                teamMentions.push(teamContact.id._serialized);
                return mention;
            }
        }
        return part;
    }));

    if (teamMentions.length) {
        const senderContact = await message.getContact();
        const senderMention = `@${senderContact.id.user}`;
        const senderId = senderContact.id._serialized;

        // Add the sender to mentions too, so their @ works
        if (!teamMentions.includes(senderId)) {
            teamMentions.unshift(senderId);
        }

        const processedMessage = `${senderMention} says (via OPM-Bot 🤖):\n${wrapInMonospace(processedParts.join(''))}`;

        message.reply(processedMessage, data.id.remote, { mentions: teamMentions });
    }
};

const processOpponentLookup = async (message) => {
    const { _data: data } = message;
    const senderContact = await message.getContact();
    const senderId = senderContact.id.user;

    const playerTeams = getPlayerTeams();
    const userTeamEntry = Object.entries(playerTeams).find(([, value]) => {
        return value.id.includes(senderId);
    });

    if (!userTeamEntry) {
        await message.reply(`Could not find your team in player_teams.json.\n\n${SENT_BY_OPM_BOT_TAG}`, data.id.remote);
        return;
    }

    const [teamName] = userTeamEntry;
    const game = await neonClient.getTeamMatchup(NFL_TEAM_CITY_ABBREVIATIONS[teamName]);

    if (!game) {
        await message.reply(`${teamName} have no game this week.\n\n${SENT_BY_OPM_BOT_TAG}`, data.id.remote);
        return;
    }

    const opponentTeamName = game.homeTeamName.toUpperCase() === teamName
        ? game.awayTeamName.toUpperCase()
        : game.homeTeamName.toUpperCase();

    const playerTeamsMap = getPlayerTeams();
    const opponentEntry = playerTeamsMap[opponentTeamName];
    const opponentMention = opponentEntry
        ? (await whatsappClient.getContactById(opponentEntry.id)).id.user
        : null;

    const emoji = NFL_TEAM_EMOJIS[opponentTeamName] || '';
    const teamEmoji = NFL_TEAM_EMOJIS[teamName] || '';

    const result = game.isComplete
        ? `Final score: ${game.homeScore} - ${game.awayScore}`
        : 'Game has not been completed yet.';

    const mentionLine = opponentMention ? `@${opponentMention}` : null;

    const monospaceBlock = wrapInMonospace([
        `${teamName} ${teamEmoji} vs ${opponentTeamName} ${emoji}`,
        result,
    ].join('\n'));

    const lines = [
        mentionLine,
        monospaceBlock,
        SENT_BY_OPM_BOT_TAG,
    ].filter(Boolean);

    await message.reply(lines.join('\n'), data.id.remote, {
        mentions: opponentMention ? [opponentEntry.id] : [],
    });
};

const processStandingsLookup = async (message) => {
    const { body } = message._data;
    const tokens = body.trim().split(/\s+/);

    const modifier = tokens[1]?.toLowerCase();
    const allowedModifiers = new Set([
        'nfl', 'afc', 'nfc',
        'afce', 'afcn', 'afcs', 'afcw',
        'nfce', 'nfcn', 'nfcs', 'nfcw',
    ]);

    if (!modifier || !allowedModifiers.has(modifier)) {
        await message.reply(
            `⚠️ Please include a valid modifier with !standings.\n\nValid options:\n• nfl\n• afc/nfc\n• afce/afcn/afcs/afcw\n• nfce/nfcn/nfcs/nfcw\n\n${SENT_BY_OPM_BOT_TAG}`,
            message['_data'].id.remote
        );
        return;
    }

    const playerTeams = getPlayerTeams();
    const standings = modifier === 'nfl'
        ? await neonClient.getStandings()
        : await neonClient.getStandings(modifier);

    const lines = [];
    const mentions = new Set();

    for (let i = 0; i < standings.length; i++) {
        const team = standings[i];
        const teamKey = team.teamName.toUpperCase();
        const playerEntry = playerTeams[teamKey];
        const lineNumber = i + 1;
        const teamEmoji = NFL_TEAM_EMOJIS[teamKey] || '';

        if (playerEntry) {
            const contact = await whatsappClient.getContactById(playerEntry.id);
            mentions.add(contact.id._serialized);
            lines.push(`${lineNumber}. @${contact.id.user} (${teamKey} ${teamEmoji}) - ${team.record}`);
        } else {
            lines.push(`${lineNumber}. ${teamKey} ${teamEmoji} - ${team.record}`);
        }
    }

    const standingsText = wrapInMonospace(lines.join('\n')) + `\n\n${SENT_BY_OPM_BOT_TAG}`;

    await message.reply(standingsText, message['_data'].id.remote, {
        mentions: Array.from(mentions),
    });
};

const processScheduleLookup = async (message, incompleteOnly = false) => {
    const { _data: data } = message;
    const { season, week } = await neonClient.getCurrentWeek();
    const schedule = await neonClient.getWeekSchedule({ incompleteOnly, season, week });
    const playerTeams = getPlayerTeams(); // teamName (uppercase) → { id }
    const mentionedIds = new Set();
    const lines = [];

    const headerLine = `${incompleteOnly ? 'Remaining games' : 'Schedule'} for week ${week} of season ${season}:\n`

    for (const game of schedule) {
        const homeTeamKey = game.homeTeamName.toUpperCase();
        const awayTeamKey = game.awayTeamName.toUpperCase();

        const homePlayer = playerTeams[homeTeamKey];
        const awayPlayer = playerTeams[awayTeamKey];

        const homeContact = homePlayer
            ? await whatsappClient.getContactById(homePlayer.id)
            : null;
        const awayContact = awayPlayer
            ? await whatsappClient.getContactById(awayPlayer.id)
            : null;

        const homeTag = homeContact ? `@${homeContact.id.user}` : game.homeTeamName;
        const awayTag = awayContact ? `@${awayContact.id.user}` : game.awayTeamName;

        if (homeContact) mentionedIds.add(homeContact.id._serialized);
        if (awayContact) mentionedIds.add(awayContact.id._serialized);

        const homeLine = `${homeTag} (${game.homeTeamName} ${NFL_TEAM_EMOJIS[homeTeamKey] || ''})`;
        const awayLine = `${awayTag} (${game.awayTeamName} ${NFL_TEAM_EMOJIS[awayTeamKey] || ''})`;

        const scoreLine = game.isComplete
            ? ` [${game.homeScore} - ${game.awayScore}]`
            : '';

        lines.push(`${homeLine} vs ${awayLine}${scoreLine}`);
    }

    const messageBody =
        wrapInMonospace(headerLine + lines.join('\n\n'))
        + `\n\n${SENT_BY_OPM_BOT_TAG}`;

    await message.reply(messageBody, data.id.remote, {
        mentions: Array.from(mentionedIds),
    });
};


const processWeekLookup = async (message) => {
    try {
        const { season, week } = await neonClient.getCurrentWeek();

        let weekText;

        if (week <= 18) {
            weekText = `week ${week}`;
        } else {
            switch (week) {
                case 19:
                    weekText = 'the Wild Card round';
                    break;
                case 20:
                    weekText = 'the Divisional round';
                    break;
                case 21:
                    weekText = 'the Championship round';
                    break;
                default:
                    weekText = 'the Super Bowl week';
            }
        }

        await message.reply(
            `${wrapInMonospace(`We are currently in ${weekText} of season ${season} as of the latest Neon Update.`)}\n${SENT_BY_OPM_BOT_TAG}`,
            message['_data'].id.remote,
        );
    } catch (err) {
        console.error('Error looking up current week', err);
        await handleErrorResponse(message);
    }
};

const handleInvalidMessage = async (message) => message.reply(
    `❌Unrecognized command. The following commands are supported:

!teamName (ex: !commanders, !was)
!opponent
!remaining
!schedule
!standings
!week
    
${SENT_BY_OPM_BOT_TAG}`,
    message['_data'].id.remote,
);

const handleErrorResponse = async (message) => message.reply(
    `❌Something went wrong processing this request.
    
${SENT_BY_OPM_BOT_TAG}`,
    message['_data'].id.remote,
);

export default async (message) => {
    const { _data: data } = message;
    const messageType = detectMessageType(data.body);

    switch (messageType) {
        case 'embedded':
            await processEmbeddedMessage(message);
            break;
        case 'team-lookup':
            await processTeamLookupRequest(message);
            break;
        case 'opponent':
            await processOpponentLookup(message);
            break;
        case 'remaining':
            await processScheduleLookup(message, true);
            break;
        case 'schedule':
            await processScheduleLookup(message);
            break;
        case 'standings':
            await processStandingsLookup(message);
            break;
        case 'week':
            await processWeekLookup(message);
            break;
        case 'invalid':
            await handleInvalidMessage(message);
    }
};
