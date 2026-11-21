/**
 * Aides « Comment ça marche ? » (lot du 21/11/2026) : 30 secondes de lecture par section, lisibles par Pierre.
 * Chaque phrase décrit ce que l'écran fait vraiment aujourd'hui ; à mettre à jour avec l'écran.
 */
export type SectionAide = "accueil" | "matchs" | "match" | "paris" | "tests" | "import" | "coach" | "sources";

export const AIDES: Record<SectionAide, { titre: string; etapes: string[] }> = {
  accueil: { titre: "L’accueil", etapes: [
    "En haut, Betster résume les opportunités du jour. Touche « Écouter Betster » pour l’entendre.",
    "Les propositions sont rangées en trois profils : Prudent, Équilibré et Audacieux. Chaque ligne donne la probabilité, la cote et le niveau de risque.",
    "Sous chaque proposition, le « pourquoi » : l’enjeu au classement, la forme et les dernières confrontations, quand on a les données.",
    "Une probabilité reste une probabilité : un pari à 70 % perd encore trois fois sur dix.",
  ] },
  matchs: { titre: "L’écran Matchs", etapes: [
    "Choisis un jour dans le bandeau, ou cherche une équipe, un championnat ou un pays.",
    "Les matchs sont rangés par pays. Touche l’étoile d’une compétition pour l’épingler en haut ; les compétitions repliées s’ouvrent d’un toucher.",
    "Sous chaque match, l’issue la plus probable d’après les cotes. « Analyse statistique indisponible » veut dire qu’on n’a pas encore de cote ni d’estimation.",
    "L’étoile d’un match le suit : tu reçois ses buts en notification. Touche le match pour sa fiche complète.",
  ] },
  match: { titre: "La fiche d’un match", etapes: [
    "Analyse : l’enjeu, la forme, les confrontations et le choix le plus probable, dans l’ordre où un analyste les regarde.",
    "Marchés : les probabilités de chaque pari, avec les cotes 1xBet, Betclic France et l’estimation Betclic Côte d’Ivoire quand elles existent.",
    "Betclic Côte d’Ivoire est une estimation à partir de Betclic France : vérifie toujours la cote sur ton appli.",
    "Touche une cote pour préparer un pari ou un test avec cette cote.",
  ] },
  paris: { titre: "Mes paris", etapes: [
    "Tous tes paris, en cours et réglés. Les résultats arrivent seuls après le match.",
    "Si un pari ne peut pas être réglé automatiquement, il t’attend ici : confirme le résultat d’un toucher.",
    "L’onglet Paris test garde tes essais sans argent réel, avec leur propre bilan.",
    "Le Bilan montre tes paris réels réglés : le résultat cumulé, par type de pari et par niveau de risque.",
  ] },
  tests: { titre: "Les paris test", etapes: [
    "Un test, c’est un pari sans argent réel : la cote et l’heure sont notées, et le résultat arrive tout seul.",
    "Crée un test depuis un match, un ticket importé, ta propre idée, ou en le dictant.",
    "Le bilan sépare les tickets et les sélections, et montre ce qui marche par type de marché, par compétition et par tipster.",
    "Rien ne se modifie après coup. Attends une trentaine de résultats avant de conclure.",
  ] },
  import: { titre: "Importer un ticket", etapes: [
    "Envoie une capture de ton ticket Betclic ou 1xBet, une vidéo d’écran, ou colle le texte.",
    "Tu peux aussi dire ton pari : touche « Dicter », parle, puis « Lire mon pari ».",
    "Chaque ligne est relue avant l’enregistrement : corrige un marché, une cote ou un match en un toucher. Une ligne non reconnue est gardée telle quelle.",
    "Choisis « J’ai parié » pour un vrai pari, ou « Tester sans miser » pour un essai.",
  ] },
  coach: { titre: "Le Coach", etapes: [
    "Ton tableau de bord : budget de la semaine, objectifs, montantes et résultats.",
    "Pose une question au Coach à l’écrit ou à la voix : « quoi jouer ce soir », « analyse-moi le match du Real », « fais-moi un combiné à 3 ».",
    "Il répond avec des probabilités et le risque de perte, à partir des cotes et des données vérifiées, jamais avec des certitudes.",
    "Fixe une perte maximale par semaine : le Coach te prévient quand tu t’en approches.",
  ] },
  sources: { titre: "Les sources", etapes: [
    "Une source, c’est un tipster, un groupe ou une page dont tu suis les pronos.",
    "Chaque prono importé est réglé après le match : la fiche de la source montre sa vraie réussite et son rendement.",
    "Les résultats sont calculés sur les pronos enregistrés, pas sur ce que la source annonce.",
    "Compare deux sources pour voir laquelle tient sur la durée.",
  ] },
};
