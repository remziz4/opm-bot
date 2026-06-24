import Database from 'better-sqlite3';
import path from 'path';
import { readFileSync } from 'fs';

const dbPath = process.env.DB_PATH || './data/opm.db';
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_teams (
    team         TEXT PRIMARY KEY,
    whatsapp_id  TEXT,
    name         TEXT
  );
  CREATE TABLE IF NOT EXISTS admins (
    whatsapp_id  TEXT PRIMARY KEY
  );
`);

const { count } = db.prepare('SELECT COUNT(*) as count FROM player_teams').get();
if (count === 0) {
    const jsonPath = path.join(process.env.TEAM_DATA_LOCATION || '.', 'player_teams.json');
    const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const insert = db.prepare('INSERT INTO player_teams (team, whatsapp_id, name) VALUES (?, ?, ?)');
    db.transaction(() => {
        for (const [team, { id, name } = {}] of Object.entries(raw)) {
            insert.run(team, id ?? null, name ?? null);
        }
    })();
    console.log(`Seeded player_teams from player_teams.json: ${Object.keys(raw).length} teams`);
}

const allTeamsStmt = db.prepare('SELECT team, whatsapp_id, name FROM player_teams');

export function getPlayerTeams() {
    const rows = allTeamsStmt.all();
    return Object.fromEntries(
        rows.map(row => [row.team, { id: row.whatsapp_id, name: row.name }])
    );
}

export function isAdmin(whatsappId) {
    return !!db.prepare('SELECT 1 FROM admins WHERE whatsapp_id = ?').get(whatsappId);
}

export function assignPlayerToTeam(team, whatsappId, name) {
    db.transaction(() => {
        db.prepare('UPDATE player_teams SET whatsapp_id = NULL, name = NULL WHERE whatsapp_id = ? AND team != ?')
          .run(whatsappId, team);
        db.prepare('UPDATE player_teams SET whatsapp_id = ?, name = ? WHERE team = ?')
          .run(whatsappId, name ?? null, team);
    })();
}

export function removePlayerFromTeam(team) {
    db.prepare('UPDATE player_teams SET whatsapp_id = NULL, name = NULL WHERE team = ?')
      .run(team);
}

export default db;