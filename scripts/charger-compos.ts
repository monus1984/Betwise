/** Charge les compositions des matchs qui commencent dans l'heure (lancé toutes les 15 min par GitHub Actions). */
import "dotenv/config";
import { chargerCompos } from "../src/lib/api-football/extras";

chargerCompos().then((r) => console.log(`Compos : ${r.trouves} trouvée(s) sur ${r.matchs} match(s) sans compo, ${r.requetes} requête(s)`)).catch((e) => { console.error(e); process.exit(1); });
