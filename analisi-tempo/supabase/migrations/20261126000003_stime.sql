-- =====================================================================
-- Analisi del tempo — Fase 4: stima delle ore al mese per categoria
-- ---------------------------------------------------------------------
-- Serve per il confronto "Stima vs Reale" del corso: quante ore al mese
-- PENSI di dedicare a ogni attività, prima di misurarle davvero.
-- =====================================================================

alter table public.categorie
  add column ore_stimate_mese numeric(6,1) check (ore_stimate_mese >= 0);

-- La stima iniziale (277 ore al mese) per gli utenti già registrati.
-- I nuovi utenti la ricevono dalla funzione qui sotto.
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

-- Anche chi accede per la prima volta DOPO questa migrazione parte con
-- la stima iniziale (modificabile dall'app: Report → Mese → Modifica stime).
create or replace function public.crea_dati_iniziali(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_supervisione uuid;
begin
  insert into public.impostazioni (user_id) values (p_user)
  on conflict (user_id) do nothing;

  if exists (select 1 from public.categorie where user_id = p_user) then
    return;
  end if;

  insert into public.categorie (user_id, codice, nome, descrizione, colore, lavoro, ordine, ore_stimate_mese) values
    (p_user, 1, 'Lavoro autonomo',         'Pensiero, riflessione, produzione individuale', '#2563eb', true, 1, 140),
    (p_user, 2, 'Telefono, e-mail, corrispondenza', null,                                     '#0891b2', true, 2, 28),
    (p_user, 3, 'Training',                'Lettura e acculturazione',                      '#7c3aed', true, 3, 20),
    (p_user, 4, 'Supervisione collaboratori', 'E programmazione attività',                  '#ea580c', true, 4, 28),
    (p_user, 5, 'Colloqui informali',      'Non programmati',                               '#db2777', true, 5, 28),
    (p_user, 6, 'Colloqui formali',        'Programmati',                                   '#16a34a', true, 6, 0),
    (p_user, 7, 'Impegni fuori sede',      'Impegni lavorativi fuori sede',                 '#ca8a04', true, 7, 5),
    (p_user, 8, 'Viaggi e trasferimenti',  null,                                            '#475569', true, 8, 28),
    (p_user, 9, 'Pausa / personale',       'Esclusa dal totale lavoro',                     '#9ca3af', false, 9, null);

  select id into v_supervisione from public.categorie where user_id = p_user and codice = 4;
  insert into public.sottocategorie (user_id, categoria_id, nome, ordine) values
    (p_user, v_supervisione, 'Cucina',    1),
    (p_user, v_supervisione, 'Sala',      2),
    (p_user, v_supervisione, 'Fornitori', 3),
    (p_user, v_supervisione, 'Eventi',    4);
end $$;
revoke execute on function public.crea_dati_iniziali(uuid) from public, anon, authenticated;
