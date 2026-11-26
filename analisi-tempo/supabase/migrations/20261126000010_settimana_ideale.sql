-- =====================================================================
-- Analisi del tempo — Settimana ideale e periodo di analisi
-- ---------------------------------------------------------------------
-- settimana_ideale (Michael Hyatt, Laura Vanderkam): i blocchi che
--   vorresti avere ogni settimana, per giorno, es. lunedì 6-8 Lavoro autonomo.
--   Formato: { "1": [ { "inizio": 6, "fine": 8, "categoria_id": "…" } ], … }
--   chiavi "0".."6" = domenica..sabato (come la fascia di lavoro).
-- analisi_dal / analisi_al: il periodo dell'esercizio del corso
--   (alcune settimane). Il Report ha una scheda "Periodo" con il
--   report finale per il coach.
-- =====================================================================
alter table public.impostazioni
  add column settimana_ideale jsonb not null default '{}'::jsonb,
  add column analisi_dal date,
  add column analisi_al date,
  add constraint analisi_date_in_ordine
    check (analisi_dal is null or analisi_al is null or analisi_al >= analisi_dal);
