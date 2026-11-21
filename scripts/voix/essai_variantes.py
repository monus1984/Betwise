"""Variantes de voix d'homme françaises (Piper) pour Betster : plus jeune, plus vive, plus chaleureuse. 21/11."""
import json, os, sys, time, wave
from piper import PiperVoice
from piper.config import SynthesisConfig

dossier = sys.argv[1]
os.makedirs(dossier, exist_ok=True)
texte = ("Bonjour ! Bonne nouvelle : aujourd’hui, j’ai analysé neuf matchs et retenu six propositions. "
         "Profil prudent : Bayern Munich contre Cologne, demain à 19 h 30. Bayern gagne, probabilité 86 pour cent. "
         "Le détail est juste en dessous !")

def fabriquer(nom, modele, vitesse, expressif, locuteur=None):
    voix = PiperVoice.load(modele)
    sid = None
    if locuteur:
        carte = json.load(open(modele + ".json")).get("speaker_id_map", {})
        print(nom, "locuteurs :", list(carte)[:10])
        sid = carte.get(locuteur)
    cfg = SynthesisConfig(length_scale=vitesse, noise_scale=expressif, noise_w_scale=0.9, speaker_id=sid)
    t0 = time.time()
    with wave.open(f"{dossier}/{nom}.wav", "wb") as wf:
        voix.synthesize_wav(texte, wf, syn_config=cfg)
    print(f"{nom} : fabriqué en {time.time() - t0:.2f} s")

fabriquer("pierre-a", "voix/fr_FR-upmc-medium.onnx", 0.88, 0.85, "pierre")
fabriquer("pierre-b", "voix/fr_FR-upmc-medium.onnx", 0.85, 0.95, "pierre")
