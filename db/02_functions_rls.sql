-- =====================================================================
-- VÉRTICE · 02_functions_rls.sql  (prefijo vtx_)
-- Generador de código, RPC de adhesión, RLS, vista de stats y Realtime.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Generador de código de adhesión único y legible (sin caracteres ambiguos)
-- ---------------------------------------------------------------------
create or replace function vtx_gen_adhesion_code() returns text as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- sin I,L,O,0,1
  code text;
  i int;
begin
  loop
    code := 'VTX-';
    for i in 1..4 loop
      code := code || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from vtx_members where adhesion_code = code);
  end loop;
  return code;
end $$ language plpgsql;

-- ---------------------------------------------------------------------
-- Deriva el rol a partir de la profundidad (igual que el prototipo)
-- ---------------------------------------------------------------------
create or replace function vtx_role_for_depth(d int) returns text as $$
  select case d
    when 0 then 'Candidato'
    when 1 then 'Coordinador General'
    when 2 then 'Líder Zonal'
    when 3 then 'Líder de Barrio'
    when 4 then 'Promotor'
    else 'Simpatizante'
  end;
$$ language sql immutable;

-- ---------------------------------------------------------------------
-- RPC de adhesión: un solo padre por usuario, atómica, security definer.
-- ---------------------------------------------------------------------
create or replace function vtx_join_with_code(p_code text, p_name text)
returns vtx_members as $$
declare
  v_parent vtx_members;
  v_child  vtx_members;
  v_uid    uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para unirte';
  end if;

  select * into v_parent from vtx_members where adhesion_code = upper(trim(p_code));
  if not found then
    raise exception 'Código de adhesión inválido: %', p_code;
  end if;

  if exists (select 1 from vtx_members where user_id = v_uid) then
    raise exception 'Este usuario ya pertenece a la red (un solo padre por persona)';
  end if;

  insert into vtx_members (user_id, parent_id, adhesion_code, full_name, status, region)
  values (v_uid, v_parent.id, vtx_gen_adhesion_code(), p_name, 'nuevo', v_parent.region)
  returning * into v_child;

  return v_child;
end $$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- Lookup público del invitador para la landing /unirse/[code]
-- ---------------------------------------------------------------------
create or replace function vtx_inviter_preview(p_code text)
returns table (full_name text, role text, subtree_size int, depth int) as $$
  select m.full_name, vtx_role_for_depth(m.depth), m.subtree_size, m.depth
  from vtx_members m
  where m.adhesion_code = upper(trim(p_code));
$$ language sql stable security definer set search_path = public;

-- ---------------------------------------------------------------------
-- Ancestros y descendientes vía ltree (para que el frontend no toque ltree)
-- ---------------------------------------------------------------------
create or replace function vtx_ancestors_of(p_id uuid)
returns setof vtx_members as $$
  select a.*
  from vtx_members a, vtx_members n
  where n.id = p_id
    and a.path @> n.path
  order by a.depth;
$$ language sql stable security definer set search_path = public;

create or replace function vtx_descendants_of(p_id uuid, p_limit int default 1000)
returns setof vtx_members as $$
  select d.*
  from vtx_members d, vtx_members n
  where n.id = p_id
    and d.path <@ n.path
    and d.id <> p_id
  order by d.depth
  limit p_limit;
$$ language sql stable security definer set search_path = public;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table vtx_members enable row level security;

-- Lectura: cualquier usuario autenticado ve la red.
drop policy if exists vtx_members_read on vtx_members;
create policy vtx_members_read on vtx_members
  for select to authenticated using (true);

-- Inserción directa BLOQUEADA: las altas solo ocurren vía vtx_join_with_code().

-- Un miembro puede actualizar SOLO su propio nombre/estado.
drop policy if exists vtx_members_update_self on vtx_members;
create policy vtx_members_update_self on vtx_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Vista de estadísticas (para el HUD; cachéala en Redis 60s desde la API)
-- ---------------------------------------------------------------------
create or replace view vtx_network_stats as
  select
    (select count(*) from vtx_members)                                      as total_members,
    (select coalesce(max(depth),0) from vtx_members)                        as max_depth,
    (select child_count from vtx_members where parent_id is null limit 1)   as ramas,
    (select count(*) from vtx_members where created_at > now() - interval '24 hours') as nuevos_hoy;

-- ---------------------------------------------------------------------
-- Realtime: publica los cambios de vtx_members para las altas en vivo.
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table vtx_members;
exception when duplicate_object then null; end $$;

-- Consultas de referencia para la API:
--   Ancestros:   select * from vtx_members where path @> (select path from vtx_members where id = $1) order by depth;
--   Descendientes: select * from vtx_members where path <@ (select path from vtx_members where id = $1) and id <> $1;
--   Hijos directos: select * from vtx_members where parent_id = $1 order by created_at;
