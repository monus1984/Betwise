import { afterEach, describe, expect, it, vi } from "vitest";
import { ssml, synthesizeAzure } from "./azure";

describe("voix Azure", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("échappe le texte et choisit une voix d'homme française", () => {
    const s = ssml("Bayern <gagne> & Köln « nul »", "fr-FR-HenriNeural");
    expect(s).toContain('xml:lang="fr-FR"');
    expect(s).toContain('<voice name="fr-FR-HenriNeural">');
    expect(s).toContain("Bayern &lt;gagne&gt; &amp; Köln « nul »");
  });
  it("appelle la bonne région avec la clé en en-tête, jamais dans l'adresse", async () => {
    const f = vi.fn(async () => new Response(new Uint8Array(500), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const r = await synthesizeAzure("Bonjour", "cle-fictive", "westeurope");
    expect(r.ok).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
    expect(url).not.toContain("cle-fictive");
    expect((init.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"]).toBe("cle-fictive");
  });
  it("signale un refus (quota, clé) sans planter", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Quota exceeded", { status: 429 })));
    expect(await synthesizeAzure("Bonjour", "k", "westeurope")).toEqual({ ok: false, status: 429, error: "Quota exceeded" });
  });
});
