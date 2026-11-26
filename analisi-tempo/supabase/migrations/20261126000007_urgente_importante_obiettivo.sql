-- =====================================================================
-- Analisi del tempo — Urgente / Importante / Allineamento all'obiettivo
-- ---------------------------------------------------------------------
-- Per ogni attività registrata, facoltativi:
--   urgente       sì/no
--   importante    sì/no         (con urgente → matrice di Eisenhower)
--   allineamento  1..5          quanto è in linea con l'obiettivo principale
-- In impostazioni: il testo dell'obiettivo principale.
-- =====================================================================
alter table public.registrazioni
  add column urgente      boolean,
  add column importante   boolean,
  add column allineamento smallint check (allineamento between 1 and 5);

alter table public.impostazioni
  add column obiettivo text check (char_length(obiettivo) <= 200);

-- sostituisci_ora ora salva anche i nuovi campi
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
     urgente, importante, allineamento)
  select (v->>'id')::uuid, p_ora_inizio, (v->>'minuti')::smallint, (v->>'categoria_id')::uuid,
    nullif(v->>'sottocategoria_id', '')::uuid, (v->>'delegabile')::boolean,
    (v->>'energia')::smallint, nullif(v->>'nota', ''),
    (v->>'urgente')::boolean, (v->>'importante')::boolean, (v->>'allineamento')::smallint
  from jsonb_array_elements(p_voci) v;
end $$;
revoke execute on function public.sostituisci_ora(timestamptz, jsonb) from public, anon;
grant execute on function public.sostituisci_ora(timestamptz, jsonb) to authenticated;
