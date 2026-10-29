// Save/load in IndexedDB (plenty of room for a full world). Attributes are packed into short strings.
const DB = "legend-offline", STORE = "saves", KEY = "career", BACKUP = "career-backup";

function packAttrs(a) { let s = ""; for (const v of a) s += String.fromCharCode(40 + Math.round(v * 10)); return s; }
function unpackAttrs(s) { const a = new Array(s.length); for (let i = 0; i < s.length; i++) a[i] = (s.charCodeAt(i) - 40) / 10; return a; }

export function serialize(G) {
  const players = {};
  for (const [id, p] of Object.entries(G.players)) players[id] = { ...p, a: packAttrs(p.a) };
  return JSON.stringify({ ...G, players });
}
export function deserialize(str) {
  const G = JSON.parse(str);
  for (const p of Object.values(G.players)) p.a = unpackAttrs(p.a);
  return G;
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
    try { const prev = await get(KEY); if (prev) await put(BACKUP, prev); await put(KEY, s); }
    catch (e) { console.warn("save failed", e); }
  });
  return saving;
}
export async function loadGame(backup = false) {
  try { const s = await get(backup ? BACKUP : KEY); return s ? deserialize(s) : null; } catch { return null; }
}
export async function deleteSave() { await del(KEY); await del(BACKUP); }
