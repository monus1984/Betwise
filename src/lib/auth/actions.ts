"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string } | undefined;

function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "E-mail et mot de passe requis." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Identifiants incorrects." };

  // Profil, source « Moi » et bankroll créés si absents (compte partagé avec Kehiwa)
  await supabase.rpc("ensure_profile");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const majeur = formData.get("majeur") === "on";
  if (!email || !password || !pseudo) return { error: "Tous les champs sont requis." };
  if (password.length < 8) return { error: "Mot de passe : 8 caractères minimum." };
  if (!majeur) return { error: "BETWISE est réservé aux personnes majeures." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { pseudo, display_name: pseudo } },
  });
  if (error) return { error: error.message.includes("already") ? "Un compte existe déjà avec cet e-mail. Connecte-toi." : "Inscription impossible pour le moment." };

  if (data.session) {
    await supabase.rpc("ensure_profile", { p_pseudo: pseudo });
    redirect("/");
  }
  return { info: "Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
