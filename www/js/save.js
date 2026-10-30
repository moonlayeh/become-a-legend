// Save/load in IndexedDB (plenty of room for a full world). Attributes are packed into short strings.
const DB = "legend-offline", STORE = "saves", KEY = "career", BACKUP = "career-backup";

function packAttrs(a) { let s = ""; for (const v of a) s += String.fromCharCode(40 + Math.round(v * 10)); return s; }
function unpackAttrs(s) { const a = new Array(s.length); for (let i = 0; i < s.length; i++) a[i] = (s.charCodeAt(i) - 40) / 10; return a; }

// Players are stored as arrays in a fixed key order (about a third of the size of plain JSON);
// keys outside the list go into a trailing object.
const PK = ["id", "fn", "ln", "nat", "birth", "birthplace", "club", "squad", "main", "positions", "foot", "wf", "height", "weight", "a", "ca", "pa", "hid", "cond", "sharp", "morale", "injury", "ban", "contract", "form", "st", "caps", "intGoals", "retired", "ycs", "bans", "mins", "no", "noClub"];
const HID = ["con", "imp", "inj", "pro", "amb", "pre", "tem", "adp", "loy", "spo"];
const ST = ["apps", "sub", "min", "gls", "ast", "rsum", "rn", "motm", "yc", "rc", "cs", "pom"];
const PKS = new Set(PK);
function packPlayer(p) {
  const out = new Array(PK.length + 1);
  for (let i = 0; i < PK.length; i++) {
    const k = PK[i]; let v = p[k];
    if (k === "a") v = packAttrs(v);
    else if (k === "hid") v = HID.map(h => v[h]);
    else if (k === "st") v = ST.every(x => !v[x]) ? 0 : ST.map(x => (x === "rsum" ? Math.round(v[x] * 10) / 10 : v[x]));
    else if (k === "cond" || k === "sharp" || k === "morale") v = Math.round(v ?? 0);
    else if (k === "form") v = (v || []).map(x => Math.round(x * 10) / 10);
    out[i] = v === undefined ? null : v;
  }
  let extra = null;
  for (const k of Object.keys(p)) if (!PKS.has(k)) (extra = extra || {})[k] = p[k];
  if (extra) out[PK.length] = extra; else out.length = PK.length;
  return out;
}
function unpackPlayer(arr) {
  const p = {};
  for (let i = 0; i < PK.length; i++) {
    const k = PK[i]; let v = arr[i];
    if (k === "a") v = unpackAttrs(v);
    else if (k === "hid") v = Object.fromEntries(HID.map((h, j) => [h, v[j]]));
    else if (k === "st") v = Object.fromEntries(ST.map((x, j) => [x, v ? v[j] : 0]));
    if (v !== null || k === "injury" || k === "club" || k === "contract") p[k] = v;
  }
  if (arr.length > PK.length && arr[PK.length]) Object.assign(p, arr[PK.length]);
  return p;
}

export function serialize(G) {
  const players = [];
  for (const p of Object.values(G.players)) players.push(packPlayer(p));
  return JSON.stringify({ ...G, players, packed: 2 });
}
export function deserialize(str) {
  const G = JSON.parse(str);
  if (G.packed === 2) {
    const players = {};
    for (const arr of G.players) { const p = unpackPlayer(arr); players[p.id] = p; }
    G.players = players; delete G.packed;
  } else for (const p of Object.values(G.players)) p.a = unpackAttrs(p.a);
  return G;
}
// gzip in the browser when available (Android WebView has CompressionStream)
async function gz(str) {
  if (typeof CompressionStream === "undefined") return str;
  try { const cs = new Blob([str]).stream().pipeThrough(new CompressionStream("gzip")); return await new Response(cs).arrayBuffer(); } catch { return str; }
}
async function gunzip(v) {
  if (typeof v === "string") return v;
  const ds = new Blob([v]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(ds).text();
}

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function put(key, val) {
  const d = await db();
  return new Promise((res, rej) => { const tx = d.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(val, key); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); });
}
async function get(key) {
  const d = await db();
  return new Promise((res, rej) => { const tx = d.transaction(STORE, "readonly"); const q = tx.objectStore(STORE).get(key); q.onsuccess = () => res(q.result ?? null); q.onerror = () => rej(q.error); });
}
async function del(key) {
  const d = await db();
  return new Promise(res => { const tx = d.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(key); tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
}

let saving = Promise.resolve();
export function saveGame(G) {
  const s = serialize(G);
  saving = saving.then(async () => {
    try { const z = await gz(s); const prev = await get(KEY); if (prev) await put(BACKUP, prev); await put(KEY, z); }
    catch (e) { console.warn("save failed", e); }
  });
  return saving;
}
export async function loadGame(backup = false) {
  try {
    const v = await get(backup ? BACKUP : KEY);
    if (!v) return null;
    const G = deserialize(await gunzip(v));
    return G;
  } catch (e) { console.warn("load failed", e); return backup ? null : loadGame(true); }
}
export async function deleteSave() { await del(KEY); await del(BACKUP); }
