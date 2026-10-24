// TheSportsDB'den Süper Lig fikstür + skorlarını çekip tek JSON'a yazar.
// Kullanım: node scripts/sync.mjs [full]   (full: tüm sezon, yoksa sadece güncel hafta ±1)
import fs from 'node:fs';

const LEAGUE = { id: '4339', season: '2026-2027', rounds: 34 };
const API = 'https://www.thesportsdb.com/api/v1/json/123/';
const FILE = `data/super-lig-${LEAGUE.season}.json`;
const KEEP = ['idEvent', 'intRound', 'strTimestamp', 'strHomeTeam', 'strAwayTeam', 'strHomeTeamBadge', 'strAwayTeamBadge', 'intHomeScore', 'intAwayScore', 'strStatus', 'strPostponed'];
const DONE = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO', 'PST', 'CANC', 'ABD']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(API + path);
    if (r.ok) return r.json();
    console.log("HTTP", r.status, path); await sleep(20000 * (i + 1));
  }
  throw new Error('fetch failed ' + path);
}
const slim = (e) => Object.fromEntries(KEEP.map((k) => [k, e[k] ?? null]));

const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { rounds: {} };
const rounds = { ...old.rounds };
const full = process.argv[2] === 'full' || !Object.keys(rounds).length;

let todo;
if (full) todo = Array.from({ length: LEAGUE.rounds }, (_, i) => i + 1);
else {
  // Güncel hafta: bitmemiş maçı olan ilk hafta
  let cur = 1;
  for (let r = 1; r <= LEAGUE.rounds; r++) {
    const evs = rounds[r] || [];
    if (!evs.length || evs.some((e) => !DONE.has(e.strStatus))) { cur = r; break; }
  }
  todo = [cur - 1, cur, cur + 1].filter((r) => r >= 1 && r <= LEAGUE.rounds);
}

for (const r of todo) {
  let j;
  try { j = await get(`eventsround.php?id=${LEAGUE.id}&r=${r}&s=${LEAGUE.season}`); } catch (err) { console.warn(err.message); break; }
  const evs = (j.events || []).map(slim).sort((a, b) => (a.strTimestamp || '').localeCompare(b.strTimestamp || ''));
  if (evs.length) rounds[r] = evs;
  await sleep(4000);
}

const out = { league: 'Süper Lig', leagueId: LEAGUE.id, season: LEAGUE.season, rounds };
const before = JSON.stringify(old.rounds || {});
if (JSON.stringify(rounds) !== before) {
  out.updatedAt = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(out));
  console.log('updated rounds', todo.join(','));
} else console.log('no change', todo.join(','));
