-- =====================================================================
-- Analisi del tempo — Fase 2: notifiche orarie
-- ---------------------------------------------------------------------
-- Come funziona l'invio ogni ora:
--   pg_cron (l'orologio del database) ogni ora al minuto 0
--     → pg_net chiama la Edge Function "notifica-oraria"
--       → la funzione guarda la fascia di lavoro di ciascun utente
--         e manda il push solo a chi è "in orario".
-- Non dipende da Vercel: funziona anche col piano gratuito.
--
-- PRIMA di questa migrazione salva i due segreti nel Vault
-- (README, passo 8): url_progetto e segreto_cron.
-- =====================================================================

-- Preferenze notifiche nelle impostazioni
alter table public.impostazioni
  add column notifiche_attive boolean not null default true,
  -- se contiene la data di oggi, oggi non arriva nessuna notifica
  add column notifiche_pausa_il date;

-- ---------------------------------------------------------------------
-- Telefoni/browser iscritti alle notifiche (uno per dispositivo)
-- ---------------------------------------------------------------------
create table public.push_iscrizioni (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
  endpoint       text not null unique,  -- indirizzo del servizio push (Apple/Google)
  p256dh         text not null,         -- chiavi per cifrare il messaggio
  auth           text not null,
  dispositivo    text,                  -- es. "iPhone", solo per riconoscerlo
  creato_il      timestamptz not null default now(),
  ultimo_invio   timestamptz,
  ultimo_errore  text
);
create index push_iscrizioni_utente_idx on public.push_iscrizioni (user_id);

alter table public.push_iscrizioni enable row level security;
create policy "solo i propri dati" on public.push_iscrizioni
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Orologio: ogni ora al minuto 0 chiama la Edge Function.
-- L'indirizzo del progetto e il segreto vengono letti dal Vault al
-- momento dell'esecuzione, così non finiscono nel codice.
-- ---------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'notifica-oraria',          -- nome del lavoro (rieseguire = aggiornarlo)
  '0 * * * *',                -- ogni ora, al minuto 0
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'url_progetto')
           || '/functions/v1/notifica-oraria',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'segreto_cron')
    ),
    body := '{"tipo": "orario"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
