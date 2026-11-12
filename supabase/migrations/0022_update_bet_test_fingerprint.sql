-- 0022 : l'empreinte d'un ticket de test garde son préfixe « test| » quand on modifie la mise, le bookmaker ou la date
create or replace function betwise.update_bet(p_bet_id uuid, p_mise numeric default null, p_bookmaker text default null, p_placed_at timestamptz default null)
 returns void language plpgsql security definer set search_path to 'betwise', 'public' as $function$
declare uid uuid := auth.uid(); b betwise.bets; ch jsonb := '{}'::jsonb;
begin
  select * into b from betwise.bets where id = p_bet_id and user_id = uid;
  if b.id is null then raise exception 'pari introuvable'; end if;
  if p_mise is not null and p_mise <> b.mise then
    if p_mise <= 0 then raise exception 'mise invalide'; end if;
    if b.statut <> 'en_cours' then raise exception 'pari réglé : la mise ne se modifie plus'; end if;
    ch := ch || jsonb_build_object('mise', jsonb_build_object('avant', b.mise, 'apres', p_mise));
    update betwise.bets set mise = p_mise where id = b.id;
    update betwise.bankroll_transactions set montant = -p_mise where bet_id = b.id and type = 'mise';
  end if;
  if p_bookmaker is not null and p_bookmaker is distinct from b.bookmaker then
    ch := ch || jsonb_build_object('bookmaker', jsonb_build_object('avant', b.bookmaker, 'apres', p_bookmaker));
    update betwise.bets set bookmaker = nullif(p_bookmaker,'') where id = b.id;
  end if;
  if p_placed_at is not null and p_placed_at <> b.placed_at then
    ch := ch || jsonb_build_object('placed_at', jsonb_build_object('avant', b.placed_at, 'apres', p_placed_at));
    update betwise.bets set placed_at = p_placed_at where id = b.id;
  end if;
  if ch <> '{}'::jsonb then
    insert into betwise.bet_versions (bet_id, changes, changed_by) values (b.id, ch, uid);
    update betwise.bets set ticket_fingerprint = case when virtuel then 'test|' else '' end || betwise.ticket_fingerprint(bookmaker, placed_at, mise, cote_totale)
      where id = b.id and ticket_fingerprint is not null;
  end if;
end $function$;
