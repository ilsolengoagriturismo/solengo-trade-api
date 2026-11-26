-- =====================================================================
-- Analisi del tempo — Fase 1: schema iniziale
-- ---------------------------------------------------------------------
-- Tabelle:
--   impostazioni      fuso orario e fascia lavorativa per giorno
--   categorie         le 8 categorie del corso + "Pausa / personale"
--   sottocategorie    facoltative (es. Supervisione → cucina, sala…)
--   registrazioni     ogni riga = N minuti di un'ora dedicati a una categoria
--
-- Ogni tabella ha user_id e Row Level Security: ogni utente vede e
-- modifica solo i propri dati, quindi l'app è già pronta per più utenti.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Impostazioni utente
-- fascia: chiavi "0".."6" = domenica..sabato (come Date.getDay() in JS)
--         inizio/fine = ore intere; fine 23 vuol dire "ultima ora 22-23"
-- ---------------------------------------------------------------------
create table public.impostazioni (
  user_id        uuid primary key default auth.uid()
                 references auth.users (id) on delete cascade,
  fuso_orario    text not null default 'Europe/Rome',
  fascia         jsonb not null default '{
    "0": {"attivo": true, "inizio": 8, "fine": 23},
    "1": {"attivo": true, "inizio": 8, "fine": 23},
    "2": {"attivo": true, "inizio": 8, "fine": 23},
    "3": {"attivo": true, "inizio": 8, "fine": 23},
    "4": {"attivo": true, "inizio": 8, "fine": 23},
    "5": {"attivo": true, "inizio": 8, "fine": 23},
    "6": {"attivo": true, "inizio": 8, "fine": 23}
  }'::jsonb,
  creato_il      timestamptz not null default now(),
  aggiornato_il  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Categorie
-- lavoro = false  → esclusa dal totale ore di lavoro (Pausa / personale)
-- codice         → numero della riga nel foglio del corso (1..8), 9 = pausa
-- ---------------------------------------------------------------------
create table public.categorie (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  codice       smallint,
  nome         text not null check (char_length(nome) between 1 and 60),
  descrizione  text check (char_length(descrizione) <= 120),
  colore       text not null default '#64748b'
               check (colore ~ '^#[0-9a-fA-F]{6}$'),
  lavoro       boolean not null default true,
  ordine       smallint not null default 0,
  attiva       boolean not null default true,
  creato_il    timestamptz not null default now()
);
create index categorie_utente_idx on public.categorie (user_id, ordine);

create table public.sottocategorie (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  categoria_id  uuid not null references public.categorie (id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 40),
  ordine        smallint not null default 0,
  attiva        boolean not null default true,
  creato_il     timestamptz not null default now()
);
create index sottocategorie_categoria_idx on public.sottocategorie (categoria_id);

-- ---------------------------------------------------------------------
-- Registrazioni
-- ora_inizio = inizio dell'ora (es. 13:00). Un'ora può essere divisa in
-- più righe (es. 30 min Lavoro autonomo + 30 min Telefono).
-- L'id lo genera il telefono: così il salvataggio offline, quando
-- viene sincronizzato, non crea doppioni.
-- ---------------------------------------------------------------------
create table public.registrazioni (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid()
                     references auth.users (id) on delete cascade,
  ora_inizio         timestamptz not null
                     check (date_trunc('hour', ora_inizio) = ora_inizio),
  minuti             smallint not null check (minuti between 1 and 60),
  categoria_id       uuid not null references public.categorie (id) on delete restrict,
  sottocategoria_id  uuid references public.sottocategorie (id) on delete set null,
  delegabile         boolean,                                   -- "Potevi delegarla?"
  energia            smallint check (energia between 1 and 3),  -- 1 bassa, 3 alta
  nota               text check (char_length(nota) <= 280),
  creato_il          timestamptz not null default now(),
  aggiornato_il      timestamptz not null default now()
);
create index registrazioni_utente_ora_idx on public.registrazioni (user_id, ora_inizio);

-- ---------------------------------------------------------------------
-- Row Level Security: ognuno vede solo i propri dati
-- ---------------------------------------------------------------------
alter table public.impostazioni   enable row level security;
alter table public.categorie      enable row level security;
alter table public.sottocategorie enable row level security;
alter table public.registrazioni  enable row level security;

create policy "solo i propri dati" on public.impostazioni
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo i propri dati" on public.categorie
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo i propri dati" on public.sottocategorie
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "solo i propri dati" on public.registrazioni
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Aggiorna automaticamente "aggiornato_il"
-- ---------------------------------------------------------------------
create function public.tocca_aggiornato_il() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.aggiornato_il := now();
  return new;
end $$;

create trigger impostazioni_aggiornato before update on public.impostazioni
  for each row execute function public.tocca_aggiornato_il();
create trigger registrazioni_aggiornato before update on public.registrazioni
  for each row execute function public.tocca_aggiornato_il();

-- ---------------------------------------------------------------------
-- Dati iniziali di un nuovo utente: impostazioni + categorie del corso.
-- È "idempotente": se l'utente ha già le categorie non fa nulla.
-- ---------------------------------------------------------------------
create function public.crea_dati_iniziali(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_supervisione uuid;
begin
  insert into public.impostazioni (user_id) values (p_user)
  on conflict (user_id) do nothing;

  if exists (select 1 from public.categorie where user_id = p_user) then
    return;
  end if;

  insert into public.categorie (user_id, codice, nome, descrizione, colore, lavoro, ordine) values
    (p_user, 1, 'Lavoro autonomo',         'Pensiero, riflessione, produzione individuale', '#2563eb', true, 1),
    (p_user, 2, 'Telefono, e-mail, corrispondenza', null,                                     '#0891b2', true, 2),
    (p_user, 3, 'Training',                'Lettura e acculturazione',                      '#7c3aed', true, 3),
    (p_user, 4, 'Supervisione collaboratori', 'E programmazione attività',                  '#ea580c', true, 4),
    (p_user, 5, 'Colloqui informali',      'Non programmati',                               '#db2777', true, 5),
    (p_user, 6, 'Colloqui formali',        'Programmati',                                   '#16a34a', true, 6),
    (p_user, 7, 'Impegni fuori sede',      'Impegni lavorativi fuori sede',                 '#ca8a04', true, 7),
    (p_user, 8, 'Viaggi e trasferimenti',  null,                                            '#475569', true, 8),
    (p_user, 9, 'Pausa / personale',       'Esclusa dal totale lavoro',                     '#9ca3af', false, 9);

  select id into v_supervisione from public.categorie where user_id = p_user and codice = 4;
  insert into public.sottocategorie (user_id, categoria_id, nome, ordine) values
    (p_user, v_supervisione, 'Cucina',    1),
    (p_user, v_supervisione, 'Sala',      2),
    (p_user, v_supervisione, 'Fornitori', 3),
    (p_user, v_supervisione, 'Eventi',    4);
end $$;

-- Solo il database può chiamarla con un utente qualsiasi
revoke execute on function public.crea_dati_iniziali(uuid) from public, anon, authenticated;

-- Quando un utente si registra (primo magic link) riceve i dati iniziali
create function public.nuovo_utente() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.crea_dati_iniziali(new.id);
  return new;
end $$;

create trigger su_nuovo_utente after insert on auth.users
  for each row execute function public.nuovo_utente();

-- Chiamata dall'app all'avvio: utile per utenti creati prima di questa
-- migrazione. Lavora sempre e solo sull'utente collegato.
create function public.prepara_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  perform public.crea_dati_iniziali(auth.uid());
end $$;
revoke execute on function public.prepara_account() from public, anon;
grant execute on function public.prepara_account() to authenticated;

-- ---------------------------------------------------------------------
-- Sostituisce in un colpo solo il contenuto di un'ora.
-- p_voci = [] svuota l'ora. Usata sia dalla registrazione rapida sia
-- dalla sincronizzazione offline: rifarla due volte dà lo stesso
-- risultato, quindi non ci sono doppioni.
-- Gira con i permessi dell'utente (RLS attiva).
-- ---------------------------------------------------------------------
create function public.sostituisci_ora(p_ora_inizio timestamptz, p_voci jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_totale int;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  if jsonb_typeof(p_voci) <> 'array' then
    raise exception 'p_voci deve essere una lista';
  end if;

  select coalesce(sum((v->>'minuti')::int), 0) into v_totale
  from jsonb_array_elements(p_voci) v;
  if v_totale > 60 then
    raise exception 'Un''ora non può superare 60 minuti (ricevuti %)', v_totale;
  end if;

  -- la categoria deve essere dell'utente (RLS filtra quelle altrui)
  if exists (
    select 1 from jsonb_array_elements(p_voci) v
    where not exists (
      select 1 from public.categorie c where c.id = (v->>'categoria_id')::uuid
    )
  ) then
    raise exception 'Categoria non valida';
  end if;

  delete from public.registrazioni
  where user_id = auth.uid() and ora_inizio = p_ora_inizio;

  insert into public.registrazioni
    (id, ora_inizio, minuti, categoria_id, sottocategoria_id, delegabile, energia, nota)
  select
    (v->>'id')::uuid,
    p_ora_inizio,
    (v->>'minuti')::smallint,
    (v->>'categoria_id')::uuid,
    nullif(v->>'sottocategoria_id', '')::uuid,
    (v->>'delegabile')::boolean,
    (v->>'energia')::smallint,
    nullif(v->>'nota', '')
  from jsonb_array_elements(p_voci) v;
end $$;
revoke execute on function public.sostituisci_ora(timestamptz, jsonb) from public, anon;
grant execute on function public.sostituisci_ora(timestamptz, jsonb) to authenticated;
