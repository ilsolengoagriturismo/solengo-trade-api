-- =====================================================================
-- Analisi del tempo — Fascia di lavoro predefinita 5:00–24:00
-- ---------------------------------------------------------------------
-- La giornata in agriturismo/ristorante parte presto e finisce tardi.
-- Prima notifica alle 6:00 (per l'ora 5–6), ultima a mezzanotte
-- (per l'ora 23–24). Si cambia dall'app: Impostazioni → Fascia di lavoro.
-- =====================================================================
alter table public.impostazioni alter column fascia set default '{
  "0": {"attivo": true, "inizio": 5, "fine": 24},
  "1": {"attivo": true, "inizio": 5, "fine": 24},
  "2": {"attivo": true, "inizio": 5, "fine": 24},
  "3": {"attivo": true, "inizio": 5, "fine": 24},
  "4": {"attivo": true, "inizio": 5, "fine": 24},
  "5": {"attivo": true, "inizio": 5, "fine": 24},
  "6": {"attivo": true, "inizio": 5, "fine": 24}
}'::jsonb;

-- utenti già presenti che hanno ancora la fascia iniziale 8–23: la porto a 5–24
update public.impostazioni
set fascia = '{
  "0": {"attivo": true, "inizio": 5, "fine": 24},
  "1": {"attivo": true, "inizio": 5, "fine": 24},
  "2": {"attivo": true, "inizio": 5, "fine": 24},
  "3": {"attivo": true, "inizio": 5, "fine": 24},
  "4": {"attivo": true, "inizio": 5, "fine": 24},
  "5": {"attivo": true, "inizio": 5, "fine": 24},
  "6": {"attivo": true, "inizio": 5, "fine": 24}
}'::jsonb
where fascia = '{
  "0": {"attivo": true, "inizio": 8, "fine": 23},
  "1": {"attivo": true, "inizio": 8, "fine": 23},
  "2": {"attivo": true, "inizio": 8, "fine": 23},
  "3": {"attivo": true, "inizio": 8, "fine": 23},
  "4": {"attivo": true, "inizio": 8, "fine": 23},
  "5": {"attivo": true, "inizio": 8, "fine": 23},
  "6": {"attivo": true, "inizio": 8, "fine": 23}
}'::jsonb;
