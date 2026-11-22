/**
 * Compte d'audit (audit@betwise.invalid) : créé et ouvert par les robots GitHub avec la clé de service, sans mot de
 * passe. Personne ne peut s'y connecter à la main : l'adresse ne reçoit aucun e-mail (.invalid est réservé).
 * Réservé aux scripts (jamais importé côté application).
 */
import { createClient, type Session } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { createAdminClient } from "../supabase/admin";

export const AUDIT_EMAIL = "audit@betwise.invalid";
export const AUDIT_PSEUDO = "Claude (audit)";

const env = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  return { url, key };
};

/** Crée le compte s'il n'existe pas ; rend son identifiant. */
export async function compteAudit(): Promise<string> {
  const admin = createAdminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === AUDIT_EMAIL);
    if (u) return u.id;
    if (data.users.length < 100) break;
  }
  const { data, error } = await admin.auth.admin.createUser({ email: AUDIT_EMAIL, email_confirm: true, user_metadata: { pseudo: AUDIT_PSEUDO, audit: true } });
  if (error || !data.user) throw error ?? new Error("création du compte d'audit impossible");
  return data.user.id;
}

/** Ouvre une session sans mot de passe : lien magique généré côté serveur, échangé aussitôt, jamais envoyé. */
export async function sessionAudit(): Promise<Session> {
  const { url, key } = env();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: AUDIT_EMAIL });
  if (error || !data.properties?.hashed_token) throw error ?? new Error("lien de session introuvable");
  const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: v, error: e2 } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (e2 || !v.session) throw e2 ?? new Error("session d'audit refusée");
  return v.session;
}

/** Client qui agit au nom du compte d'audit : la RLS et les fonctions de l'app s'appliquent comme pour un testeur. */
export function clientAudit(session: Session) {
  const { url, key } = env();
  return createClient<Database, "betwise">(url, key, {
    db: { schema: "betwise" },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
