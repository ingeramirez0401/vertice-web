-- =====================================================================
-- VÉRTICE · 01_schema.sql  (prefijo vtx_)
-- Esquema de la red mesh (un padre / muchos hijos) sobre Postgres + ltree.
-- Ejecutar en el editor SQL de Supabase (o psql sobre tu Postgres).
-- =====================================================================

create extension if not exists ltree;       -- materialized path para el árbol
create extension if not exists pgcrypto;     -- gen_random_uuid()

-- Estado del miembro (coincide con la leyenda del prototipo)
do $$ begin
  create type vtx_member_status as enum ('activo','nuevo','inactivo');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tabla principal
-- ---------------------------------------------------------------------
create table if not exists vtx_members (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique references auth.users(id) on delete set null, -- 1 auth.user = 1 member
  parent_id     uuid references vtx_members(id) on delete restrict,       -- NULL solo en la raíz
  adhesion_code text not null unique,                                      -- p.ej. 'VTX-7F3A'
  full_name     text not null,
  role          text,            -- opcional; se puede derivar de depth (ver vista abajo)
  status        vtx_member_status not null default 'nuevo',
  region        text,            -- p.ej. 'Gobernación'
  path          ltree not null,  -- ruta materializada de ids (m<uuidsin guiones>...)
  depth         int  not null default 0,   -- nlevel(path) - 1
  child_count   int  not null default 0,   -- hijos directos
  subtree_size  int  not null default 0,   -- descendientes totales (su "red")
  created_at    timestamptz not null default now()
);

create index if not exists vtx_members_path_gist  on vtx_members using gist (path);
create index if not exists vtx_members_parent_idx on vtx_members (parent_id);
create index if not exists vtx_members_code_idx   on vtx_members (adhesion_code);
create index if not exists vtx_members_created_idx on vtx_members (created_at desc);
create index if not exists vtx_members_depth_idx  on vtx_members (depth);

-- ---------------------------------------------------------------------
-- Trigger BEFORE INSERT: calcula path y depth a partir del padre.
-- ---------------------------------------------------------------------
create or replace function vtx_members_set_path() returns trigger as $$
declare parent_path ltree;
        self_label  text := 'm' || replace(new.id::text, '-', '');
begin
  if new.parent_id is null then
    new.path  := text2ltree(self_label);
    new.depth := 0;
  else
    select path into parent_path from vtx_members where id = new.parent_id;
    if parent_path is null then
      raise exception 'Padre % no existe', new.parent_id;
    end if;
    new.path  := parent_path || text2ltree(self_label);
    new.depth := nlevel(new.path) - 1;
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists trg_vtx_members_set_path on vtx_members;
create trigger trg_vtx_members_set_path
  before insert on vtx_members
  for each row execute function vtx_members_set_path();

-- ---------------------------------------------------------------------
-- Trigger AFTER INSERT: incrementa contadores de ancestros.
-- ---------------------------------------------------------------------
create or replace function vtx_members_bump_ancestors() returns trigger as $$
begin
  update vtx_members
     set subtree_size = subtree_size + 1
   where path @> new.path and id <> new.id;

  if new.parent_id is not null then
    update vtx_members set child_count = child_count + 1 where id = new.parent_id;
  end if;

  return null;
end $$ language plpgsql;

drop trigger if exists trg_vtx_members_bump on vtx_members;
create trigger trg_vtx_members_bump
  after insert on vtx_members
  for each row execute function vtx_members_bump_ancestors();

-- ---------------------------------------------------------------------
-- Trigger AFTER DELETE: decrementa contadores al borrar.
-- ---------------------------------------------------------------------
create or replace function vtx_members_drop_ancestors() returns trigger as $$
begin
  update vtx_members
     set subtree_size = greatest(subtree_size - 1, 0)
   where path @> old.path and id <> old.id;
  if old.parent_id is not null then
    update vtx_members set child_count = greatest(child_count - 1, 0) where id = old.parent_id;
  end if;
  return null;
end $$ language plpgsql;

drop trigger if exists trg_vtx_members_drop on vtx_members;
create trigger trg_vtx_members_drop
  after delete on vtx_members
  for each row execute function vtx_members_drop_ancestors();
