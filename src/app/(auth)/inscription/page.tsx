"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthState } from "@/lib/auth/actions";
import { Button, Field, Input, Notice } from "@/components/ui";

export default function Page() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Pseudo" hint="Tel qu’il apparaîtra sur tes sources partagées.">
        <Input name="pseudo" autoComplete="nickname" maxLength={30} required />
      </Field>
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Mot de passe" hint="8 caractères minimum.">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input type="checkbox" name="majeur" className="mt-1 h-4 w-4" required />
        <span>J’ai 18 ans ou plus. BETWISE est un outil de suivi et d’analyse ; il ne prend aucune mise et ne promet aucun gain.</span>
      </label>
      {state?.error && <Notice>{state.error}</Notice>}
      {state?.info && <Notice kind="info">{state.info}</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer mon compte"}</Button>
      <p className="text-center text-sm text-slate-600">
        Déjà inscrit ? <Link href="/connexion" className="font-medium text-slate-900 underline">Se connecter</Link>
      </p>
    </form>
  );
}
