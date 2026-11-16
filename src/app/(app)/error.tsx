"use client";

import { Button, Empty } from "@/components/ui";

/** Un écran n'a pas pu se charger : on le dit, sans jargon, et on propose de réessayer. Tes données ne sont pas touchées. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="pt-16">
      <Empty titre="Cet écran n’a pas pu se charger" action={<Button onClick={reset} className="!w-auto px-6">Réessayer</Button>}>
        Rien n’a été modifié dans tes paris ni dans ta bankroll. Si ça recommence, vérifie ta connexion.
        {error.digest ? ` Référence : ${error.digest}.` : ""}
      </Empty>
    </div>
  );
}
