-- 0058 (23/11) : le score exact a sa propre rubrique (Mounir et conseil d'IA) : il ne compte plus dans le bilan principal
-- d'une source (réussite, rendement), mais il reste compté à part (cs_regles, cs_gagnes, cs_unites), jamais effacé.
-- Même vue, mêmes colonnes dans le même ordre, trois colonnes ajoutées à la fin ; security_invoker conservé.
-- Réversible : recréer la vue sans le filtre « market_code <> 'CS' » (définition de 0056/0047, voir l'historique).
create or replace view betwise.source_proof with (security_invoker = true) as
select s.id as source_id,
  count(p.id) as prouves,
  count(p.id) filter (where p.resultat in ('gagne', 'perdu')) as prouves_regles,
  count(p.id) filter (where p.resultat = 'gagne') as prouves_gagnes,
  count(p.id) filter (where p.resultat in ('gagne', 'perdu') and p.cote_annoncee is not null) as prouves_avec_cote,
  round(coalesce(sum(case when p.cote_annoncee is not null and p.resultat = 'gagne' then p.cote_annoncee - 1
                          when p.cote_annoncee is not null and p.resultat = 'perdu' then -1 end), 0), 2) as prouves_unites,
  round(avg(1 / p.cote_annoncee) filter (where p.resultat in ('gagne', 'perdu') and p.cote_annoncee > 1), 4) as attendu,
  count(p.id) filter (where p.statut = 'declare') as apres_coup,
  count(p.id) filter (where p.statut = 'declare' and p.resultat in ('gagne', 'perdu')) as apres_coup_regles,
  count(p.id) filter (where p.statut = 'declare' and p.resultat = 'gagne') as apres_coup_gagnes,
  max(p.logged_at) as dernier_prono,
  (select count(*) from betwise.predictions c where c.source_id = s.id and c.statut <> 'annule' and c.market_code = 'CS' and c.resultat in ('gagne', 'perdu')) as cs_regles,
  (select count(*) from betwise.predictions c where c.source_id = s.id and c.statut <> 'annule' and c.market_code = 'CS' and c.resultat = 'gagne') as cs_gagnes,
  (select round(coalesce(sum(case when c.cote_annoncee is not null and c.resultat = 'gagne' then c.cote_annoncee - 1
                                  when c.cote_annoncee is not null and c.resultat = 'perdu' then -1 end), 0), 2)
     from betwise.predictions c where c.source_id = s.id and c.statut <> 'annule' and c.market_code = 'CS') as cs_unites
from betwise.sources s
left join betwise.predictions p on p.source_id = s.id and p.statut <> 'annule' and p.market_code <> 'CS'
group by s.id;
