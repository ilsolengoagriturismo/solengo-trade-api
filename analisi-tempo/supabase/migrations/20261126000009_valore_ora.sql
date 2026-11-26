-- =====================================================================
-- Analisi del tempo — Valore della tua ora (Dan Martell, "Buy Back Your Time")
-- ---------------------------------------------------------------------
-- Quanto vale un'ora del tuo tempo, in euro. Serve al report per dire
-- quanto "costano" le ore delegabili.
-- =====================================================================
alter table public.impostazioni
  add column valore_ora numeric(7,2) check (valore_ora >= 0);
