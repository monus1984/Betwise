/**
 * Lien vers la page d'une source. On accepte ce que les gens collent vraiment : une adresse complète, une adresse sans
 * « https:// », ou un identifiant (@canal) qu'on complète selon le type de source. Toujours en https, jamais autre chose.
 */
const BASE: Record<string, string> = {
  canal_telegram: "https://t.me/",
  compte_instagram: "https://www.instagram.com/",
  page_facebook: "https://www.facebook.com/",
};

export function normalizeLink(input: string | null | undefined, type?: string): string | null {
  let v = (input ?? "").trim();
  if (!v || /\s/.test(v)) return null;
  const handle = v.match(/^@([A-Za-z0-9._]{2,64})$/);
  if (handle) return type && BASE[type] ? BASE[type] + handle[1] : null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)) return null; // javascript:, tg:, intent:…
  v = v.replace(/^http:\/\//i, "https://");
  if (!/^https:\/\//i.test(v)) v = "https://" + v;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) || u.username || u.password) return null;
    const out = u.toString();
    return out.length <= 300 ? out : null;
  } catch { return null; }
}

/** Lien à ouvrir pour une source : celui enregistré, sinon celui qu'on peut déduire de son identifiant. */
export function linkOf(s: { lien?: string | null; identifiant_externe?: string | null; type: string }): string | null {
  if (s.lien) return normalizeLink(s.lien);
  const id = s.identifiant_externe?.trim();
  if (!id) return null;
  return id.startsWith("@") || /^(https?:\/\/|www\.|[a-z0-9-]+\.(com|me|org|net|fr|ci)\/)/i.test(id) ? normalizeLink(id, s.type) : null;
}

/** Nom court du site, pour le bouton : « Facebook », « Telegram », sinon le domaine. */
export function linkLabel(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^(www|m|web)\./, "");
    if (/facebook\.com$|^fb\.(com|me)$/.test(h)) return "Facebook";
    if (/^t\.me$|telegram\.(me|org)$/.test(h)) return "Telegram";
    if (/instagram\.com$/.test(h)) return "Instagram";
    if (/tiktok\.com$/.test(h)) return "TikTok";
    if (/whatsapp\.com$|^wa\.me$/.test(h)) return "WhatsApp";
    if (/youtube\.com$|^youtu\.be$/.test(h)) return "YouTube";
    if (/^(x|twitter)\.com$/.test(h)) return "X";
    return h;
  } catch { return "la page"; }
}
