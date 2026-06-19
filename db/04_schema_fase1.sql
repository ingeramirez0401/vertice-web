-- =====================================================================
-- VÉRTICE · 04_schema_fase1.sql
-- Fase 1: Inteligencia Electoral — extensión no destructiva del esquema.
-- Ejecutar DESPUÉS de 90_backup.sql y ANTES de 91_wipe.sql.
-- =====================================================================

-- -----------------------------------------------------------------------
-- 1. Columnas electorales en vtx_members (todas nullables, backward-compat)
-- -----------------------------------------------------------------------
alter table vtx_members
  add column if not exists cedula           text,
  add column if not exists phone            text,
  add column if not exists municipio_codigo text,
  add column if not exists municipio        text,
  add column if not exists puesto_codigo    text,
  add column if not exists puesto_nombre    text,
  add column if not exists mesa             text,
  add column if not exists verified         boolean not null default false,
  add column if not exists verified_at      timestamptz;

-- Unicidad de cédula (se ignoran NULLs → backward-compat con datos anteriores)
do $$ begin
  alter table vtx_members add constraint vtx_members_cedula_uq unique (cedula);
exception when duplicate_object then null; end $$;

create index if not exists vtx_members_cedula_idx     on vtx_members (cedula)           where cedula is not null;
create index if not exists vtx_members_municipio_idx  on vtx_members (municipio_codigo) where municipio_codigo is not null;
create index if not exists vtx_members_verified_idx   on vtx_members (verified);

-- -----------------------------------------------------------------------
-- 2. Catálogo de municipios
-- -----------------------------------------------------------------------
create table if not exists vtx_municipios (
  codigo          text primary key,
  nombre          text not null,
  lat             numeric(9,6) not null,
  lng             numeric(9,6) not null,
  potencial_votos int not null default 0,
  created_at      timestamptz not null default now()
);

grant select on vtx_municipios to anon, authenticated;

-- -----------------------------------------------------------------------
-- 3. Jerarquía electoral (reemplaza la general)
-- -----------------------------------------------------------------------
create or replace function vtx_role_for_depth(d int) returns text as $$
  select case
    when d = 0 then 'Candidato'
    when d = 1 then 'Coordinador Municipal'
    when d = 2 then 'Líder de Puesto'
    when d = 3 then 'Promotor'
    else            'Simpatizante'
  end;
$$ language sql immutable;

-- -----------------------------------------------------------------------
-- 4. RPC vtx_join_with_code extendida con datos electorales
--    — Primero se elimina la firma anterior para evitar sobrecarga.
-- -----------------------------------------------------------------------
drop function if exists vtx_join_with_code(text, text);

create or replace function vtx_join_with_code(
  p_code             text,
  p_name             text,
  p_cedula           text    default null,
  p_phone            text    default null,
  p_municipio_codigo text    default null,
  p_puesto_codigo    text    default null,
  p_puesto_nombre    text    default null
)
returns vtx_members as $$
declare
  v_parent    vtx_members;
  v_child     vtx_members;
  v_uid       uuid := auth.uid();
  v_municipio text;
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

  if p_cedula is not null and
     exists (select 1 from vtx_members where cedula = p_cedula) then
    raise exception 'Esta cédula ya está registrada en la red';
  end if;

  if p_municipio_codigo is not null then
    select nombre into v_municipio from vtx_municipios where codigo = p_municipio_codigo;
  end if;

  insert into vtx_members (
    user_id, parent_id, adhesion_code, full_name, status, region,
    cedula, phone, municipio_codigo, municipio, puesto_codigo, puesto_nombre
  )
  values (
    v_uid, v_parent.id, vtx_gen_adhesion_code(), p_name, 'nuevo', v_parent.region,
    p_cedula, p_phone, p_municipio_codigo, v_municipio, p_puesto_codigo, p_puesto_nombre
  )
  returning * into v_child;

  return v_child;
end $$ language plpgsql security definer set search_path = public;

-- -----------------------------------------------------------------------
-- 5. RPC de alta asistida (captador registra sin requerir cuenta del elector)
-- -----------------------------------------------------------------------
create or replace function vtx_quick_add(
  p_name             text,
  p_cedula           text    default null,
  p_phone            text    default null,
  p_municipio_codigo text    default null,
  p_puesto_codigo    text    default null,
  p_puesto_nombre    text    default null
)
returns vtx_members as $$
declare
  v_parent    vtx_members;
  v_child     vtx_members;
  v_uid       uuid := auth.uid();
  v_municipio text;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión para captar simpatizantes';
  end if;

  select * into v_parent from vtx_members where user_id = v_uid;
  if not found then
    raise exception 'Tu usuario no está registrado en la red';
  end if;

  if p_cedula is not null and
     exists (select 1 from vtx_members where cedula = p_cedula) then
    raise exception 'Esta cédula ya está registrada en la red';
  end if;

  if p_municipio_codigo is not null then
    select nombre into v_municipio from vtx_municipios where codigo = p_municipio_codigo;
  end if;

  insert into vtx_members (
    user_id, parent_id, adhesion_code, full_name, status, region,
    cedula, phone, municipio_codigo, municipio, puesto_codigo, puesto_nombre
  )
  values (
    null, v_parent.id, vtx_gen_adhesion_code(), p_name, 'nuevo', v_parent.region,
    p_cedula, p_phone, p_municipio_codigo, v_municipio, p_puesto_codigo, p_puesto_nombre
  )
  returning * into v_child;

  return v_child;
end $$ language plpgsql security definer set search_path = public;

-- -----------------------------------------------------------------------
-- 6. Vista: cobertura por municipio
-- -----------------------------------------------------------------------
create or replace view vtx_coverage_by_municipio as
  select
    m.codigo,
    m.nombre,
    m.lat,
    m.lng,
    m.potencial_votos,
    count(v.id)                                          as total_miembros,
    count(v.id) filter (where v.verified = true)         as verificados,
    round(
      count(v.id)::numeric / nullif(m.potencial_votos, 0) * 100, 2
    )                                                    as pct_potencial,
    round(
      count(v.id) filter (where v.verified)::numeric
      / nullif(count(v.id), 0) * 100, 1
    )                                                    as pct_verificados
  from vtx_municipios m
  left join vtx_members v on v.municipio_codigo = m.codigo
  group by m.codigo, m.nombre, m.lat, m.lng, m.potencial_votos
  order by total_miembros desc;

grant select on vtx_coverage_by_municipio to authenticated;

-- -----------------------------------------------------------------------
-- 7. Vista: KPIs del tablero del candidato
-- -----------------------------------------------------------------------
create or replace view vtx_dashboard_stats as
  select
    (select count(*)                                   from vtx_members)                      as total_miembros,
    (select count(*)                                   from vtx_members where verified = true) as verificados,
    (select count(distinct municipio_codigo)            from vtx_members where municipio_codigo is not null) as municipios_cubiertos,
    (select count(*)                                   from vtx_municipios)                   as municipios_total,
    round(
      (select count(*) from vtx_members where verified = true)::numeric
      / nullif((select count(*) from vtx_members), 0) * 100, 1
    )                                                                                          as pct_verificacion,
    (select sum(potencial_votos)                       from vtx_municipios)                   as potencial_total,
    (select count(*) from vtx_members
      where created_at > now() - interval '24 hours')                                         as nuevos_hoy;

grant select on vtx_dashboard_stats to authenticated;

-- -----------------------------------------------------------------------
-- 8. Asegurar Realtime activo
-- -----------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table vtx_members;
exception when duplicate_object then null; end $$;
