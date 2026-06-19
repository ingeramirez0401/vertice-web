-- =====================================================================
-- VÉRTICE · 91_wipe.sql
-- Limpia los datos de ejemplo. NO toca el esquema ni auth.users.
-- PREREQUISITO: 90_backup.sql ya ejecutado.
-- =====================================================================

-- Desactivar RLS temporalmente para poder truncar
alter table vtx_members disable row level security;

truncate table vtx_members restart identity cascade;

-- Restaurar RLS
alter table vtx_members enable row level security;

-- Verificar
select count(*) as total_after_wipe from vtx_members;  -- debe ser 0
