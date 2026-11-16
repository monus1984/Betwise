import Link from "next/link";
import { Empty } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-24">
      <Empty titre="Cette page n’existe pas" action={<Link href="/" className="rounded-xl bg-brand px-6 py-3 text-base font-semibold text-on-fill">Revenir à l’accueil</Link>}>
        Le lien est peut-être ancien, ou le pari a été retiré.
      </Empty>
    </main>
  );
}
