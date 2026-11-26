-- =====================================================================
-- Analisi del tempo — Collegamento con Esydo (energia misurata)
-- ---------------------------------------------------------------------
-- L'app del tempo può usare un account diverso da quello di Esydo
-- (es. l'account dedicato del codice personale). Questa tabella dice
-- quale utente Esydo corrisponde a quale utente del tempo.
-- La crea solo l'amministratore (SQL Editor): RLS attiva e nessuna
-- regola per gli utenti, quindi dall'app non si può né leggere né scrivere.
--
--   insert into public.collegamento_esydo (user_id, esydo_user_id)
--   values ('<id utente tempo>', '<id utente Esydo>');
-- =====================================================================
create table public.collegamento_esydo (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  esydo_user_id  uuid not null references auth.users (id) on delete cascade,
  creato_il      timestamptz not null default now()
);
alter table public.collegamento_esydo enable row level security;
revoke all on public.collegamento_esydo from anon, authenticated;

-- ---------------------------------------------------------------------
-- Energia Esydo (escore) ora per ora, per l'utente collegato.
-- Restituisce solo dati aggregati per ora, solo dell'utente Esydo
-- collegato a chi chiama, e solo nel periodo richiesto (max 400 giorni).
-- ---------------------------------------------------------------------
create or replace function public.energia_esydo_per_ora(p_da timestamptz, p_a timestamptz)
returns table (ora timestamptz, escore numeric, letture int)
language plpgsql security definer set search_path = '' stable as $$
declare
  v_esydo uuid;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  if p_a - p_da > interval '400 days' then
    raise exception 'Periodo troppo lungo';
  end if;
  select esydo_user_id into v_esydo from public.collegamento_esydo where user_id = auth.uid();
  if v_esydo is null then
    return; -- nessun collegamento: nessun dato
  end if;
  return query
    select date_trunc('hour', e.recorded_at) as ora,
           round(avg(e.escore), 1) as escore,
           count(*)::int as letture
    from public.escore_readings e
    where e.user_id = v_esydo
      and e.recorded_at >= p_da and e.recorded_at < p_a
      and e.escore is not null
    group by 1
    order by 1;
end $$;
revoke execute on function public.energia_esydo_per_ora(timestamptz, timestamptz) from public, anon;
grant execute on function public.energia_esydo_per_ora(timestamptz, timestamptz) to authenticated;
