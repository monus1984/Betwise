-- 0014 : bootstrap_ci renvoyait du double precision ; cast + arrondi en numeric
CREATE OR REPLACE FUNCTION betwise.bootstrap_ci(p_gains numeric[], p_iter integer DEFAULT 200)
 RETURNS TABLE(ic_bas numeric, ic_haut numeric) LANGUAGE plpgsql IMMUTABLE AS $function$
declare n int := coalesce(array_length(p_gains, 1), 0); means numeric[] := '{}'; i int; j int; acc numeric;
begin
  if n < 5 then return query select null::numeric, null::numeric; return; end if;
  perform setseed(0.4242);
  for i in 1..p_iter loop
    acc := 0;
    for j in 1..n loop acc := acc + p_gains[1 + floor(random() * n)::int]; end loop;
    means := means || (acc / n);
  end loop;
  return query select round((percentile_cont(0.05) within group (order by m))::numeric, 4), round((percentile_cont(0.95) within group (order by m))::numeric, 4) from unnest(means) m;
end $function$;
