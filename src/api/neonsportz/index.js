import axios from "axios";

let apiClient;

const DIV_LETTER_MAP = { e: 'East', n: 'North', s: 'South', w: 'West' };

const neonGameToLightRecord = (game) => ({
    homeTeamName: game.homeTeam?.teamName,
    awayTeamName: game.awayTeam?.teamName,
    isComplete: [2, 3].includes(game.status),
    homeScore: game.homeScore,
    awayScore: game.awayScore
});

const getClient = async () => {
    if (!apiClient) {
        apiClient = axios.create({
            baseURL: `${process.env.NEON_API_URL}/leagues/${process.env.NEON_LEAGUE_ABBREV}`,
        });
    }

    return apiClient;
};

const getCurrentWeek = async () => {
    const client = await getClient();

    try {
        const response = await client.get('/teams?size=1');
        const [team] = response.data.results;

        if (team) {
            return {
                season: team.seasonIndex + 1,
                week: team.weekIndex + 1,
                stage: team.stageIndex,
            }
        } else {
            throw new Error('Invalid response format or empty data array');
        }
    } catch (error) {
        console.error('Failed to fetch current week:', error);
        throw error;
    }
};

const getTeamMatchup = async (teamAbbrev) => {
    const client = await getClient();

    try {
        const { season, week, stage } = await getCurrentWeek();
        const response = await client.get(`/games/?seasonIndex=${season - 1}&weekIndex=${week -1}&stageIndex=${stage}&team__abbrName=${teamAbbrev}&size=0`);

        return response.data.length
            ? neonGameToLightRecord(response.data[0])
            : null;
    } catch (error) {
        console.error(`Failed to fetch matchup for ${teamAbbrev}:`, error);
        throw error;
    }
};

const getWeekSchedule = async ({
   incompleteOnly = false,
   season,
   week,
   stage
} = {}) => {
    const client = await getClient();
    if (season === undefined || week === undefined) {
        const weekInfo = await getCurrentWeek();
        season = weekInfo.season;
        week = weekInfo.week;
        stage = weekInfo.stage;
    }
    try {
        const response = await client.get(`/games/?seasonIndex=${season - 1}&weekIndex=${week - 1}&stageIndex=${stage}&size=0`);
        let games = response.data;

        if (incompleteOnly) {
            games = games.filter((game) => game.status === 1);
        }

        return games.map(neonGameToLightRecord);
    } catch (error) {
        console.error('Failed to fetch current week:', error.message);
        throw error;
    }
};

const getStandings = async (grouping = '') => {
    const client = await getClient();

    let groupQueryParam = '';
    switch (grouping?.toLowerCase().trim()) {
        case '':
            break;
        case 'afc':
        case 'nfc':
            groupQueryParam = `&conferenceName=${grouping.toUpperCase()}`;
            break;
        default: {
            const conf = grouping.substring(0,3).toUpperCase();
            const divLetter = grouping.substring(3,4);
            groupQueryParam = `&divName=${encodeURI(`${conf} ${DIV_LETTER_MAP[divLetter.toLowerCase()]}`)}`
        }
    }
    try {
        const response = await client.get(`/standings/?ordering=seed${groupQueryParam}`)
        return response.data.map((team, index) => ({
            teamName: team.teamName,
            record: `${team.totalWins}-${team.totalLosses}`,
            rank: index + 1
        }));
    } catch (err) {
        console.error('Failed to get standings:', err);
        throw err;
    }
};

export default {
    getCurrentWeek,
    getStandings,
    getTeamMatchup,
    getWeekSchedule,
};
