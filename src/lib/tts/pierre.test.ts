import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signer, synthesizePierre } from "./pierre";

describe("voix Pierre", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("signe le texte avec l'horodatage, comme la fonction Python le vérifie", () => {
    const s = signer("Bonjour", "cle", 1795000000);
    expect(s).toEqual({ t: "1795000000", sig: createHmac("sha256", "cle").update("1795000000.Bonjour").digest("hex") });
  });
  it("n'envoie jamais la clé, seulement la signature", async () => {
    const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(2000)]);
    const f = vi.fn(async () => new Response(new Uint8Array(wav), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const r = await synthesizePierre("Bonjour", "https://exemple.app", "cle-secrete");
    expect(r.ok).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://exemple.app/api/voix");
    expect(String(init.body)).not.toContain("cle-secrete");
    expect(JSON.stringify(init.headers)).not.toContain("cle-secrete");
  });
  it("signale une fonction absente ou en panne sans planter", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not found", { status: 404 })));
    expect(await synthesizePierre("Bonjour", "https://exemple.app", "k")).toMatchObject({ ok: false, status: 404 });
  });
});
