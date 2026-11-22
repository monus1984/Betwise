/**
 * Comptes robots BETWISE : créés et ouverts par les workflows GitHub avec la clé de service,
 * sans mot de passe. Les adresses .invalid sont réservées et ne reçoivent aucun e-mail.
 * Ces fonctions sont exclusivement réservées aux scripts (jamais importées côté application).
 */
import { createClient, type Session } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import { createAdminClient } from "../supabase/admin";

export const AUDIT_EMAIL = "audit@betwise.invalid";
export const AUDIT_PSEUDO = "Claude (audit)";
export const CHATGPT_TIPSTER_EMAIL = "chatgpt-tipster@betwise.invalid";
export const CHATGPT_TIPSTER_PSEUDO = "ChatGPT (tipster)";
export const FUSION_TIPSTER_EMAIL = "fusion-tipster@betwise.invalid";
export const FUSION_TIPSTER_PSEUDO = "Fusion ChatGPT + Claude";

const env = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  return { url, key };
};

/** Crée un compte robot s'il n'existe pas ; renvoie son identifiant. */
export async function compteRobot(email: string, pseudo: string): Promise<string> {
  const admin = createAdminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u.id;
    if (data.users.length < 100) break;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, email_confirm: true, user_metadata: { pseudo, audit: true, robot: true },
  });
  if (error || !data.user) throw error ?? new Error(`création du compte robot ${email} impossible`);
  return data.user.id;
}

/** Compatibilité avec le compte d'audit existant de Claude. */
export function compteAudit(): Promise<string> {
  return compteRobot(AUDIT_EMAIL, AUDIT_PSEUDO);
}

/** Ouvre une session sans mot de passe : le magic link est généré et échangé, jamais envoyé. */
export async function sessionRobot(email: string): Promise<Session> {
  const { url, key } = env();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw error ?? new Error(`lien de session introuvable pour ${email}`);
  const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: v, error: e2 } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (e2 || !v.session) throw e2 ?? new Error(`session robot refusée pour ${email}`);
  return v.session;
}

/** Compatibilité avec le workflow Claude existant. */
export function sessionAudit(): Promise<Session> {
  return sessionRobot(AUDIT_EMAIL);
}

/** Client agissant au nom du compte robot ; RLS et RPC de l'application restent appliquées. */
export function clientAudit(session: Session) {
  const { url, key } = env();
  return createClient<Database, "betwise">(url, key, {
    db: { schema: "betwise" },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
