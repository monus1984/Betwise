"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { signIn, type AuthState } from "@/lib/auth/actions";
import { Button, Field, Input, Notice } from "@/components/ui";

function Form() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={params.get("next") ?? "/"} />
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Mot de passe">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state?.error && <Notice>{state.error}</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</Button>
      <p className="text-center text-sm text-slate-600">
        Pas encore de compte ? <Link href="/inscription" className="font-medium text-slate-900 underline">S’inscrire</Link>
      </p>
      <p className="text-center text-xs text-slate-500">Un compte Kehiwa fonctionne ici avec les mêmes identifiants.</p>
    </form>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
