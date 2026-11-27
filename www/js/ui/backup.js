// Back up the career to a file and restore it. On the phone the file goes through Android's share
// sheet (save it to Files, Google Drive, WhatsApp...); in a browser it downloads.
import { exportBytes, importBytes } from "../save.js";
import { toast } from "./core.js";
import { fullName } from "../player.js";

const b64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const fileName = G => { const u = G.players[G.user.pid]; return `legend-${fullName(u).replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.blsave`; };

export async function exportSave(G) {
  const bytes = await exportBytes(G), name = fileName(G);
  const cap = window.Capacitor, P = cap?.Plugins || {};
  if (cap?.isNativePlatform?.() && P.Filesystem && P.Share) {
    const w = await P.Filesystem.writeFile({ path: name, data: b64(bytes), directory: "CACHE" });
    await P.Share.share({ title: "Cadangan save Become a Legend", text: "Simpan file ini (misalnya ke Google Drive atau folder Download).", files: [w.uri], dialogTitle: "Simpan cadangan save" });
    return name;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return name;
}
export function pickAndImport(onLoaded) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".blsave,application/octet-stream,application/gzip,*/*";
  inp.onchange = async () => {
    const f = inp.files?.[0]; if (!f) return;
    try { const G = await importBytes(await f.arrayBuffer()); toast("Save berhasil dipulihkan."); onLoaded(G); }
    catch (e) { console.warn(e); toast(e.message?.startsWith("File ini") ? e.message : "Gagal membaca file save."); }
  };
  inp.click();
}
