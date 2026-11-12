import * as webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";

type Db = SupabaseClient<Database, "betwise">;
type Vapid = { publicKey: string; privateKey: string };

/**
 * Clés VAPID du push : générées par l'application au premier besoin et gardées en base (table app_secrets,
 * lisible seulement par le rôle de service). Elles ne passent ni par un écran ni par une variable à saisir.
 */
export async function getVapid(admin: Db): Promise<Vapid> {
  const read = async () => (await admin.from("app_secrets").select("value").eq("name", "vapid").maybeSingle()).data?.value as Vapid | undefined;
  const existing = await read();
  if (existing?.publicKey && existing.privateKey) return existing;
  const keys = webpush.generateVAPIDKeys();
  await admin.from("app_secrets").upsert({ name: "vapid", value: { publicKey: keys.publicKey, privateKey: keys.privateKey } }, { onConflict: "name", ignoreDuplicates: true });
  const stored = await read(); // si deux appels se croisent, tout le monde lit la même paire
  if (!stored) throw new Error("clés de notification indisponibles");
  return stored;
}

/** Envoie les notifications en attente (au plus 200), supprime les abonnements expirés. */
export async function sendPending(admin: Db, onlyUser?: string) {
  const vapid = await getVapid(admin);
  webpush.setVapidDetails("mailto:contact@betwise.app", vapid.publicKey, vapid.privateKey);
  let q = admin.from("notifications").select("id, user_id, type, cle, titre, corps, url").is("sent_at", null).order("created_at").limit(200);
  if (onlyUser) q = q.eq("user_id", onlyUser);
  const { data: pending } = await q;
  if (!pending?.length) return { notifications: 0, envois: 0, expires: 0 };
  const users = [...new Set(pending.map((n) => n.user_id))];
  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", users);
  let envois = 0, expires = 0;
  const now = new Date().toISOString();
  for (const n of pending) {
    const mine = (subs ?? []).filter((s) => s.user_id === n.user_id);
    const live = n.cle.startsWith("live:");
    // Direct : une seule notification par match, remplacée et ré-annoncée à chaque événement
    const payload = JSON.stringify({ title: n.titre, body: n.corps, url: n.url, tag: live ? n.cle.split(":").slice(0, 2).join(":") : n.type === "coup_envoi" ? "coup_envoi" : n.id, renotify: live });
    await Promise.all(mine.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: live ? 600 : 3 * 3600, urgency: n.type === "coup_envoi" ? "high" : "normal" });
        envois++;
        await admin.from("push_subscriptions").update({ last_ok_at: now }).eq("id", s.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { expires++; await admin.from("push_subscriptions").delete().eq("id", s.id); } // abonnement révoqué par le téléphone
      }
    }));
    await admin.from("notifications").update({ sent_at: now }).eq("id", n.id);
  }
  return { notifications: pending.length, envois, expires };
}
