-- =====================================================================
-- Analisi del tempo — Fase 4: stima delle ore al mese per categoria
-- ---------------------------------------------------------------------
-- Serve per il confronto "Stima vs Reale" del corso: quante ore al mese
-- PENSI di dedicare a ogni attività, prima di misurarle davvero.
-- =====================================================================

alter table public.categorie
  add column ore_stimate_mese numeric(6,1) check (ore_stimate_mese >= 0);

-- La stima iniziale (277 ore al mese) per gli utenti già registrati.
-- I nuovi utenti partono senza stima e la inseriscono dall'app.
update public.categorie set ore_stimate_mese = case codice
    when 1 then 140   -- Lavoro autonomo
    when 2 then 28    -- Telefono, e-mail, corrispondenza
    when 3 then 20    -- Training
    when 4 then 28    -- Supervisione collaboratori
    when 5 then 28    -- Colloqui informali
    when 6 then 0     -- Colloqui formali
    when 7 then 5     -- Impegni fuori sede
    when 8 then 28    -- Viaggi e trasferimenti
  end
where codice between 1 and 8 and ore_stimate_mese is null;
