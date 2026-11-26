-- =====================================================================
-- Analisi del tempo — Accesso con link personale (senza email/password)
-- ---------------------------------------------------------------------
-- Ogni riga collega l'IMPRONTA (sha256) di una chiave personale a un
-- account dedicato all'app. La chiave in chiaro non è mai salvata qui:
-- sta solo nel link personale dell'utente.
-- La tabella è leggibile solo dal server (funzione accesso-diretto):
-- RLS attiva e nessuna regola per anon/authenticated.
--
-- Per creare un accesso (SQL Editor):
--   insert into public.accessi_diretti (chiave_hash, email)
--   values (encode(extensions.digest('CHIAVESENZATRATTINI', 'sha256'), 'hex'),
--           'tempo-nome@example.com');
-- =====================================================================
create table public.accessi_diretti (
  chiave_hash   text primary key,          -- sha256 esadecimale della chiave
  email         text not null,             -- account dedicato all'app
  creato_il     timestamptz not null default now(),
  ultimo_uso    timestamptz
);
alter table public.accessi_diretti enable row level security;
revoke all on public.accessi_diretti from anon, authenticated;
