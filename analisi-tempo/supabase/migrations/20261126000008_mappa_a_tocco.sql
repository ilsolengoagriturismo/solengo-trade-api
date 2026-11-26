-- =====================================================================
-- Analisi del tempo — Mappa a tocco
-- ---------------------------------------------------------------------
-- Un tocco su una mappa quadrata dà due valori continui da 1,0 a 5,0:
--   urgenza       (orizzontale)  quanto era urgente
--   allineamento  (verticale)    quanto era in linea con l'obiettivo
-- I campi sì/no urgente, importante e delegabile vengono ricavati
-- dall'app dalla posizione (centro della mappa = 3,0):
--   urgente     = urgenza > 3
--   importante  = allineamento > 3
--   delegabile  = urgente e non importante (riquadro in basso a destra)
-- =====================================================================
alter table public.registrazioni
  add column urgenza numeric(2,1) check (urgenza between 1 and 5);

-- l'allineamento passa da intero (1..5) a un decimale (1,0..5,0)
alter table public.registrazioni
  alter column allineamento type numeric(2,1) using allineamento::numeric(2,1);

create or replace function public.sostituisci_ora(p_ora_inizio timestamptz, p_voci jsonb)
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
  select coalesce(sum((v->>'minuti')::int), 0) into v_totale from jsonb_array_elements(p_voci) v;
  if v_totale > 60 then
    raise exception 'Un''ora non può superare 60 minuti (ricevuti %)', v_totale;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_voci) v
    where not exists (select 1 from public.categorie c where c.id = (v->>'categoria_id')::uuid)
  ) then
    raise exception 'Categoria non valida';
  end if;
  delete from public.registrazioni where user_id = auth.uid() and ora_inizio = p_ora_inizio;
  insert into public.registrazioni
    (id, ora_inizio, minuti, categoria_id, sottocategoria_id, delegabile, energia, nota,
     urgente, importante, allineamento, urgenza)
  select (v->>'id')::uuid, p_ora_inizio, (v->>'minuti')::smallint, (v->>'categoria_id')::uuid,
    nullif(v->>'sottocategoria_id', '')::uuid, (v->>'delegabile')::boolean,
    (v->>'energia')::smallint, nullif(v->>'nota', ''),
    (v->>'urgente')::boolean, (v->>'importante')::boolean,
    round((v->>'allineamento')::numeric, 1), round((v->>'urgenza')::numeric, 1)
  from jsonb_array_elements(p_voci) v;
end $$;
revoke execute on function public.sostituisci_ora(timestamptz, jsonb) from public, anon;
grant execute on function public.sostituisci_ora(timestamptz, jsonb) to authenticated;
