"""Essai de la voix Tom : un extrait façon « point du jour » à deux vitesses, avec le temps de synthèse."""
import sys, time, wave, os
from piper import PiperVoice
from piper.config import SynthesisConfig

modele, dossier = sys.argv[1], sys.argv[2]
os.makedirs(dossier, exist_ok=True)
t0 = time.time(); voix = PiperVoice.load(modele); print(f"chargement {time.time() - t0:.2f} s")

texte = (
    "Bonjour. Aujourd’hui, j’ai analysé neuf matchs à venir et retenu six propositions. "
    "Profil prudent. Bayern Munich contre Cologne, demain à 19 h 30 : Bayern gagne. "
    "Probabilité 86 pour cent, donc ça ne passe pas environ 14 fois sur 100. Cote 1 virgule 20. "
    "Face-à-face, deux derniers : deux victoires du Bayern. "
    "Le détail est juste en dessous. Pour me poser une question, touche mon portrait en bas de l’écran."
)
for nom, vitesse in [("tom-normal", 1.0), ("tom-vif", 0.9)]:
    t0 = time.time()
    with wave.open(f"{dossier}/{nom}.wav", "wb") as wf:
        voix.synthesize_wav(texte, wf, syn_config=SynthesisConfig(length_scale=vitesse))
    with wave.open(f"{dossier}/{nom}.wav") as wf:
        duree = wf.getnframes() / wf.getframerate()
    print(f"{nom} : {duree:.1f} s d’audio fabriquées en {time.time() - t0:.2f} s")
