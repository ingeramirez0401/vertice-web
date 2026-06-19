-- =====================================================================
-- VÉRTICE · 90_backup.sql
-- Respaldo de vtx_members antes de la Fase 1.
-- EJECUTAR PRIMERO, antes de cualquier modificación.
-- =====================================================================

create table if not exists vtx_members_backup_f1 as
  select *, now() as backed_up_at from vtx_members;

-- Para descargar CSV externo desde psql:
-- \copy vtx_members to '/tmp/vtx_members_backup.csv' csv header;
-- Desde Supabase UI: Table Editor → Export CSV.

select count(*) as filas_respaldadas from vtx_members_backup_f1;
