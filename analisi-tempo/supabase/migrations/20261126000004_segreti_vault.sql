-- =====================================================================
-- Analisi del tempo — Segreti delle notifiche nel Vault (facoltativo)
-- ---------------------------------------------------------------------
-- Alternativa ai "Secrets" delle Edge Functions: le chiavi VAPID e il
-- segreto del cron stanno nel Vault (cifrato) e la funzione
-- notifica-oraria le legge da qui se non le trova tra i suoi Secrets.
-- Nomi nel Vault: vapid_public_key, vapid_private_key, vapid_subject,
--                 segreto_cron (lo stesso usato dal job pg_cron).
-- =====================================================================
create or replace function public.segreti_notifiche() returns jsonb
language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name in ('vapid_public_key', 'vapid_private_key', 'vapid_subject', 'segreto_cron');
$$;
-- Solo il server (service_role) può leggerla: mai il browser.
revoke execute on function public.segreti_notifiche() from public, anon, authenticated;
grant execute on function public.segreti_notifiche() to service_role;
