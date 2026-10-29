// Dates are stored as day numbers (days since 1 Jan 2000, UTC).
const MS = 86400000;
const EPOCH = Date.UTC(2000, 0, 1);
export const day = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / MS);
export function ymd(n) { const dt = new Date(EPOCH + n * MS); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), wd: dt.getUTCDay() }; }
export const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
export const BULAN_PANJANG = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
export const HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
export function fmt(n, long = false) { const { y, m, d } = ymd(n); return `${d} ${(long ? BULAN_PANJANG : BULAN)[m - 1]} ${y}`; }
export function fmtDay(n) { const { y, m, d, wd } = ymd(n); return `${HARI[wd]}, ${d} ${BULAN[m - 1]} ${y}`; }
export function ageOn(birth, today) {
  const b = ymd(birth), t = ymd(today);
  let a = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) a--;
  return a;
}
// Season label for a date: seasons run July–June
export function seasonOf(n) { const { y, m } = ymd(n); const s = m >= 7 ? y : y - 1; return s; }
export const seasonLabel = s => `${s}/${String((s + 1) % 100).padStart(2, "0")}`;
// Next weekday (0=Sun..6=Sat) on or after n
export function nextWeekday(n, wd) { while (ymd(n).wd !== wd) n++; return n; }
