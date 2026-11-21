"""
Voix de Betster « Pierre enthousiaste » (21/11, choix de Mounir), gratuite : Piper, modèle upmc medium, locuteur pierre.
Appelée seulement par /api/tts (côté serveur) : la demande porte une signature HMAC calculée avec la clé de service
Supabase, qui ne circule jamais. Renvoie un WAV mono 24 kHz ; /api/tts le compresse en MP3.

Réglages validés à l'écoute le 21/11 (extrait « C-pose », choisi pour l'articulation) :
- débit 1,02, intonation régulière (noise 0,55), pauses régulières (noise_w 0,7) ;
- voix montée d'environ 1,5 demi-ton : on fabrique à 22 050 Hz et on étiquette à 24 000 Hz, ce qui monte la hauteur
  de 1,47 demi-ton et accélère de 8,8 % — compensé en fabriquant avec un débit 1,02 × 1,0884 ;
- aigus éclaircis (+4 dB environ au-dessus de 3 kHz) et volume ramené à un niveau constant.
"""
import hashlib, hmac, io, json, os, time, wave
from http.server import BaseHTTPRequestHandler

import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
MODELE = os.path.join(ICI, "..", "voix", "fr_FR-upmc-medium.onnx")
TAUX_SORTIE = 24000
RAPPORT = TAUX_SORTIE / 22050  # 1,0884
MAX_CARACTERES = 1500
_voix = None
_reglages = None


def voix():
    global _voix, _reglages
    if _voix is None:
        from piper import PiperVoice
        from piper.config import SynthesisConfig
        _voix = PiperVoice.load(MODELE)
        locuteur = json.load(open(MODELE + ".json")).get("speaker_id_map", {}).get("pierre")
        _reglages = SynthesisConfig(length_scale=1.02 * RAPPORT, noise_scale=0.55, noise_w_scale=0.7, speaker_id=locuteur)
    return _voix, _reglages


def eclaircir(x: np.ndarray, gain_db: float = 4.0) -> np.ndarray:
    """Plateau d'aigus approché : on ajoute une part de (signal − signal lissé). Vectorisé, sans dépendance."""
    noyau = np.hanning(9)[1:-1]
    noyau /= noyau.sum()
    lisse = np.convolve(x, noyau, mode="same")
    return x + (10 ** (gain_db / 20) - 1) * (x - lisse)


def niveler(x: np.ndarray, rms_db: float = -18.0, crete_db: float = -1.5) -> np.ndarray:
    rms = float(np.sqrt(np.mean(x ** 2))) or 1e-9
    crete = float(np.max(np.abs(x))) or 1e-9
    return x * min(10 ** (rms_db / 20) / rms, 10 ** (crete_db / 20) / crete)


def fabriquer(texte: str) -> bytes:
    v, cfg = voix()
    tampon = io.BytesIO()
    with wave.open(tampon, "wb") as wf:
        v.synthesize_wav(texte, wf, syn_config=cfg)
    tampon.seek(0)
    with wave.open(tampon, "rb") as wf:
        brut = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    son = np.clip(niveler(eclaircir(brut)), -1.0, 1.0)
    sortie = io.BytesIO()
    with wave.open(sortie, "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(TAUX_SORTIE)  # étiquetage à 24 kHz : voix plus haute
        wf.writeframes((son * 32767).astype("<i2").tobytes())
    return sortie.getvalue()


def signature_valide(texte: str, t: str, sig: str, cle: str, maintenant: float | None = None) -> bool:
    if not cle or not t or not sig:
        return False
    try:
        if abs((maintenant or time.time()) - int(t)) > 120:
            return False
    except ValueError:
        return False
    attendu = hmac.new(cle.encode(), f"{t}.{texte}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(attendu, sig)


class handler(BaseHTTPRequestHandler):
    def _repondre(self, code: int, corps: bytes, type_: str = "application/json"):
        self.send_response(code)
        self.send_header("Content-Type", type_)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self):
        self._repondre(405, b'{"error":"POST seulement"}')

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            corps = json.loads(self.rfile.read(min(n, 20000)) or b"{}")
        except Exception:
            return self._repondre(400, b'{"error":"demande illisible"}')
        texte = str(corps.get("text") or "")[:MAX_CARACTERES].strip()
        if not signature_valide(texte, str(corps.get("t") or ""), str(corps.get("sig") or ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")):
            return self._repondre(401, b'{"error":"signature"}')
        if len(texte) < 2:
            return self._repondre(400, b'{"error":"texte vide"}')
        try:
            return self._repondre(200, fabriquer(texte), "audio/wav")
        except Exception as e:  # le serveur Node passe alors à la voix suivante
            return self._repondre(500, json.dumps({"error": str(e)[:200]}).encode())
