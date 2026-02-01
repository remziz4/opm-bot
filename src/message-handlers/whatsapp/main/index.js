import fs from 'fs';
import path from 'path';
import neonClient from "../../../api/neonsportz/index.js";
import {NFL_TEAM_CITY_ABBREVIATIONS, NFL_TEAM_EMOJIS, teamAliases} from "../../../data/teams/index.js";
import { wrapInMonospace } from "../../../util/string/index.js";
import wahaClient from '../../../api/whatsapp/index.js';

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
    const trimmedMsg = msg?.trim() ?? '';

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

const processTeamLookupRequest = async (req) => {
    const teamName = teamAliases.get(req.message.content.substring(1).toUpperCase());
    const playerTeamRecord = getPlayerTeams()[teamName];
    if (playerTeamRecord) {
        const messageContent = `${wrapInMonospace(`@${trimIdSuffix(playerTeamRecord.id)} ${NFL_TEAM_EMOJIS[teamName]}`)}\n${SENT_BY_OPM_BOT_TAG}`;
        await wahaClient.sendMessage({
            chatId: req.chatId,
            text: messageContent,
            replyInfo: { senderId: req.senderId, messageId: req.message.id },
            mentions: [playerTeamRecord.id],

        });
    }
}

const processEmbeddedMessage = async (req) => {
    const playerTeams = getPlayerTeams();
    const teamMentions = [];

    const parts = req.message.content.split(/(\s+)/);
    const processedParts = await Promise.all(parts.map(async (part) => {
        if (part.match(/^!\w{2,}/)) {
            const teamName = teamAliases.get(part.substring(1).toUpperCase());
            const teamRecord = playerTeams[teamName];
            if (teamRecord) {
                const teamContact = teamRecord.id;
                const mention = `@${trimIdSuffix(teamContact)} ${NFL_TEAM_EMOJIS[teamName]}`;
                teamMentions.push(teamContact);
                return mention;
            }
        }
        return part;
    }));

    if (teamMentions.length) {
        const senderMention = `@${req.senderId}`;

        // Add the sender to mentions too, so their @ works
        if (!teamMentions.includes(req.senderId)) {
            teamMentions.unshift(req.senderId);
        }

        const processedMessage = `${trimIdSuffix(senderMention)} says (via OPM-Bot 🤖):\n${wrapInMonospace(processedParts.join(''))}`;
        await wahaClient.sendMessage({ chatId: req.chatId, mentions: teamMentions, text: processedMessage, replyInfo: { senderId: req.senderId, messageId: req.message.id } });
        // message.reply(processedMessage, data.id.remote, { mentions: teamMentions });
    }
};

const processOpponentLookup = async (req) => {
    const playerTeams = getPlayerTeams();
    const userTeamEntry = Object.entries(playerTeams).find(([, value]) => {
        return value.id.includes(req.senderId);
    });

    if (!userTeamEntry) {
        await wahaClient.sendMessage({
            chatId: req.chatId,
            text: `Could not find your team in player_teams.json.\n\n${SENT_BY_OPM_BOT_TAG}`,
            replyInfo: { senderId: req.senderId, messageId: req.message.id },
        });
        return;
    }

    const [teamName] = userTeamEntry;
    const game = await neonClient.getTeamMatchup(NFL_TEAM_CITY_ABBREVIATIONS[teamName]);

    if (!game) {
        await wahaClient.sendMessage({
            chatId: req.chatId,
            text: `${teamName} have no game this week.\n\n${SENT_BY_OPM_BOT_TAG}`,
            replyInfo: { senderId: req.senderId, messageId: req.message.id }
        });
        return;
    }

    const playerIsHome = game.homeTeamName.toUpperCase() === teamName;

    const opponentTeamName = playerIsHome
        ? game.awayTeamName.toUpperCase()
        : game.homeTeamName.toUpperCase();

    const playerTeamsMap = getPlayerTeams();
    const opponentEntry = playerTeamsMap[opponentTeamName];

    const opponentEmoji = NFL_TEAM_EMOJIS[opponentTeamName] || '';
    const teamEmoji = NFL_TEAM_EMOJIS[teamName] || '';

    const scores = playerIsHome ? [game.homeScore, game.awayScore] : [game.awayScore, game.homeScore];

    const result = game.isComplete
        ? `Final score: ${scores[0]} - ${scores[1]}`
        : 'Game has not been completed yet.';

    const mentionLine = `@${trimIdSuffix(opponentEntry.id)}`;

    const monospaceBlock = wrapInMonospace([
        `${teamName} ${teamEmoji} vs ${opponentTeamName} ${opponentEmoji}`,
        result,
    ].join('\n'));

    const lines = [
        mentionLine,
        monospaceBlock,
        SENT_BY_OPM_BOT_TAG,
    ].filter(Boolean);

    await wahaClient.sendMessage({
        chatId: req.chatId,
        text: lines.join('\n'),
        mentions: [opponentEntry.id],
        replyInfo: { senderId: req.senderId, messageId: req.message.id }
    });
};

const processStandingsLookup = async (req) => {
    const modifiers = req.message.content.trim().split(/\s+/).slice(1);

    const selection = modifiers[0]?.toLowerCase();
    const allowedModifiers = new Set([
        'nfl', 'afc', 'nfc',
        'afce', 'afcn', 'afcs', 'afcw',
        'nfce', 'nfcn', 'nfcs', 'nfcw',
    ]);

    if (!selection || !allowedModifiers.has(selection)) {
        await wahaClient.sendMessage({
            chatId: req.chatId,
            text: `⚠️ Please include a valid modifier with !standings.\n\nValid options:\n• nfl\n• afc/nfc\n• afce/afcn/afcs/afcw\n• nfce/nfcn/nfcs/nfcw\n\n${SENT_BY_OPM_BOT_TAG}`,
            replyInfo: { senderId: req.senderId, messageId: req.message.id }
        });
        return;
    }

    const useMentions = modifiers[1]?.toLowerCase() === 'tag';

    const playerTeams = getPlayerTeams();
    const standings = selection === 'nfl'
        ? await neonClient.getStandings()
        : await neonClient.getStandings(selection);

    const lines = [];
    const mentions = new Set();

    for (let i = 0; i < standings.length; i++) {
        const team = standings[i];
        const teamKey = team.teamName.toUpperCase();
        const playerEntry = playerTeams[teamKey];
        const lineNumber = i + 1;
        const teamEmoji = NFL_TEAM_EMOJIS[teamKey] || '';

        if (playerEntry) {
            if (useMentions) {
                lines.push(`${lineNumber}. @${trimIdSuffix(playerEntry.id)} (${teamKey} ${teamEmoji}) - ${team.record}`);
                mentions.add(playerEntry.id);
            } else {
                lines.push(`${lineNumber}. ${playerEntry.name} (${teamKey} ${teamEmoji}) - ${team.record}`);
            }
        } else {
            lines.push(`${lineNumber}. ${teamKey} ${teamEmoji} - ${team.record}`);
        }
    }

    const standingsText = wrapInMonospace(lines.join('\n')) + `\n\n${SENT_BY_OPM_BOT_TAG}`;

    await wahaClient.sendMessage({
        chatId: req.chatId,
        text: standingsText,
        replyInfo: { senderId: req.senderId, messageId: req.message.id },
        mentions: Array.from(mentions)
    });
};

const processScheduleLookup = async (req, incompleteOnly = false) => {
    const [_, modifier] = req.message.content.trim().split(/\s+/);
    const useMentions = modifier?.toLowerCase() === 'tag';

    const { season, week, stage } = await neonClient.getCurrentWeek();
    const schedule = await neonClient.getWeekSchedule({ incompleteOnly, season, week, stage });
    const playerTeams = getPlayerTeams(); // teamName (uppercase) → { id, name }
    const mentionedIds = new Set();
    const lines = [];

    const weekText = getWeekText(week, stage);

    const headerLine = `${incompleteOnly ? 'Remaining games' : 'Schedule'} for ${weekText} of season ${season}:\n`

    for (const game of schedule) {
        const homeTeamKey = game.homeTeamName.toUpperCase();
        const awayTeamKey = game.awayTeamName.toUpperCase();

        const homePlayer = playerTeams[homeTeamKey];
        const awayPlayer = playerTeams[awayTeamKey];

        const homeTag = useMentions && homePlayer
            ? `@${trimIdSuffix(homePlayer.id)}`
            : homePlayer?.name ?? game.homeTeamName;
        const awayTag = useMentions && awayPlayer
            ? `@${trimIdSuffix(awayPlayer.id)}`
            : awayPlayer?.name ?? game.awayTeamName;

        if (useMentions) {
            if (homePlayer) mentionedIds.add(homePlayer.id);
            if (awayPlayer) mentionedIds.add(awayPlayer.id);
        }

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

    await wahaClient.sendMessage({
        chatId: req.chatId,
        text: messageBody,
        mentions: Array.from(mentionedIds),
        replyInfo: { senderId: req.senderId, messageId: req.message.id }
    });
};


const processWeekLookup = async (req) => {
    try {
        const { season, week, stage } = await neonClient.getCurrentWeek();
        
        const weekText = getWeekText(week, stage);

        await wahaClient.sendMessage({
            chatId: req.chatId,
            text: `${wrapInMonospace(`We are currently in ${weekText} of season ${season} as of the latest Neon Update.`)}\n${SENT_BY_OPM_BOT_TAG}`,
            replyInfo: { senderId: req.senderId, messageId: req.message.id }
        });
    } catch (err) {
        console.error('Error looking up current week', err);
        await handleErrorResponse(req);
    }
};

const getWeekText = (week, stage) => {
    let weekText;
    
    if (stage === 0) {
        weekText = `Preseason week ${week}`;
    } else if (week <= 18) {
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
    return weekText;
};

const handleInvalidMessage = async (req) => {
    const errorText = `❌Unrecognized command. The following commands are supported:

!teamName (ex: !commanders, !was)
!opponent
!remaining
!schedule
!standings
!week
    
${SENT_BY_OPM_BOT_TAG}`;

  await wahaClient.sendMessage({
      chatId: req.chatId,
      text: errorText,
      replyInfo: { senderId: req.senderId, messageId: req.message.id }
  });
};

const handleErrorResponse = async (req) => wahaClient.sendMessage({
    chatId: req.chatId,
    text: `⚠️ An error occurred while processing your request. Please try again later.\n\n${SENT_BY_OPM_BOT_TAG}`,
    replyInfo: { senderId: req.senderId, messageId: req.message.id }
});

export default async (req) => {
    const messageType = detectMessageType(req.message.content);
    switch (messageType) {
        case 'embedded':
            await processEmbeddedMessage(req);
            break;
        case 'team-lookup':
            await processTeamLookupRequest(req);
            break;
        case 'opponent':
            await processOpponentLookup(req);
            break;
        case 'remaining':
            await processScheduleLookup(req, true);
            break;
        case 'schedule':
            await processScheduleLookup(req);
            break;
        case 'standings':
            await processStandingsLookup(req);
            break;
        case 'week':
            await processWeekLookup(req);
            break;
        case 'invalid':
            await handleInvalidMessage(req);
    }
};

const trimIdSuffix = (id) => id.replace(/@[^@]*$/, '');
