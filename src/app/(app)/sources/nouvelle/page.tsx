"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createSource, type ActionState } from "@/lib/sources/actions";
import { Button, Field, Input, Notice } from "@/components/ui";
import { PageHeader } from "@/components/page-header";

export default function NouvelleSourcePage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createSource, undefined);
  return (
    <>
      <Link href="/sources" className="mb-3 inline-block text-sm text-slate-600">‹ Sources</Link>
      <PageHeader title="Nouvelle source" subtitle="Un pronostiqueur, une page, un canal, un site." />
      <form action={action} className="space-y-4">
        <Field label="Type">
          <select name="type" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base" defaultValue="tipster">
            <option value="tipster">Pronostiqueur</option>
            <option value="canal_telegram">Canal Telegram</option>
            <option value="page_facebook">Page Facebook</option>
            <option value="compte_instagram">Compte Instagram</option>
            <option value="site">Site de prédictions</option>
          </select>
        </Field>
        <Field label="Nom">
          <Input name="nom" placeholder="ex. Manu le parieur" maxLength={60} required />
        </Field>
        <Field label="Identifiant ou lien" hint="@canal, URL de la page… Sert à reconnaître la même source chez d’autres utilisateurs.">
          <Input name="identifiant_externe" placeholder="@manuleparieur" />
        </Field>
        <Field label="Lien de la page (facultatif)" hint="Colle l’adresse de sa page Facebook, de son canal Telegram, de son compte… Tu pourras l’ouvrir depuis sa fiche.">
          <Input name="lien" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://www.facebook.com/…" maxLength={300} />
        </Field>
        <Field label="Note (facultatif)">
          <Input name="description" placeholder="Spécialisé Ligue 1, publie le matin" maxLength={300} />
        </Field>
        <Field label="Visibilité" hint="Partagée : ses pronos sont mis en commun avec les autres utilisateurs, ce qui fait grandir son historique plus vite. Privée : visible par toi seul.">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-3 text-sm">
              <input type="radio" name="visibilite" value="partagee" defaultChecked /> Partagée
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-3 text-sm">
              <input type="radio" name="visibilite" value="privee" /> Privée
            </label>
          </div>
        </Field>
        {state?.error && <Notice>{state.error}</Notice>}
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer la source"}</Button>
      </form>
    </>
  );
}
