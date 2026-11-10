import { NextResponse, type NextRequest } from "next/server";

/**
 * Cible de partage Android (POST multipart depuis la feuille de partage).
 * Une image partagée est gardée en mémoire le temps d'une redirection vers /import,
 * qui la lit via sessionStorage côté client ; un texte/lien passe par l'URL.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const text = String(form.get("text") ?? "");
  const url = String(form.get("url") ?? "");
  const title = String(form.get("title") ?? "");
  const files = form.getAll("image").filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    const q = new URLSearchParams({ text, url, title });
    return NextResponse.redirect(new URL(`/import?${q}`, req.url), 303);
  }
  // Les fichiers ne survivent pas à une redirection : on renvoie une page qui les remet dans l'import
  const parts = await Promise.all(files.slice(0, 6).map(async (f) => ({ name: f.name, type: f.type || "image/jpeg", b64: Buffer.from(await f.arrayBuffer()).toString("base64") })));
  const html = `<!doctype html><meta charset="utf-8"><title>BETWISE</title><body style="font-family:system-ui;padding:24px">Ouverture de l’import…
<script>try{sessionStorage.setItem("betwise.shared",JSON.stringify(${JSON.stringify(parts)}))}catch(e){}location.replace("/import?shared=1")</script>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
