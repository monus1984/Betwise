/**
 * Horizon d'un passage des tipsters (23/11) : le matin, toute la journée d'Abidjan (le lundi, les matchs commencent
 * surtout le soir : 5 matchs seulement à 07:50 avec 10 h) ; ensuite, les 10 heures suivantes.
 */
export function horizonHeures(now = new Date()): number {
  const h = now.getUTCHours() + now.getUTCMinutes() / 60; // Abidjan = UTC
  return h < 12 ? Math.max(10, Math.ceil(24 - h)) : 10;
}
