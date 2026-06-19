-- =====================================================================
-- VÉRTICE · 05_seed_electoral.sql
-- Dataset para demo: candidatura a Gobernación de Norte de Santander.
-- Raíz: Silvano Serrano. ~1.500 miembros. 12 municipios.
-- PREREQUISITO: 04_schema_fase1.sql y 91_wipe.sql ejecutados.
-- =====================================================================

-- Deshabilitar RLS para la inserción masiva
alter table vtx_members disable row level security;

-- -----------------------------------------------------------------------
-- 1. Municipios de Norte de Santander
-- -----------------------------------------------------------------------
insert into vtx_municipios (codigo, nombre, lat, lng, potencial_votos) values
  ('54001', 'Cúcuta',            7.893900, -72.507800, 560000),
  ('54874', 'Villa del Rosario', 7.833300, -72.466700,  70000),
  ('54405', 'Los Patios',        7.833300, -72.500000,  62000),
  ('54261', 'El Zulia',          7.933300, -72.600000,  18000),
  ('54553', 'Puerto Santander',  8.362200, -72.408300,  10000),
  ('54673', 'San Cayetano',      7.866700, -72.625000,   4500),
  ('54498', 'Ocaña',             8.237500, -73.356100,  75000),
  ('54518', 'Pamplona',          7.375800, -72.648300,  45000),
  ('54810', 'Tibú',              8.640300, -72.736100,  38000),
  ('54720', 'Sardinata',         8.083300, -72.800000,  22000),
  ('54003', 'Ábrego',            8.087500, -73.220600,  28000),
  ('54172', 'Chinácota',         7.605600, -72.600000,  16000)
on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------
-- 2. Estructura de la red
-- -----------------------------------------------------------------------
do $$
declare
  -- IDs de árbol
  v_root  uuid;
  v_coord uuid;
  v_lid   uuid;
  v_pro   uuid;
  lids    uuid[];
  pros    uuid[];

  -- Contador secuencial (cédulas + nombres)
  v_idx   int := 0;
  i       int;

  -- Generadores de nombres colombianos
  nm text[] := array[
    'Carlos','Luis','Jorge','Andrés','José','Juan','Eduardo','Miguel','Rafael','Álvaro',
    'Hernando','Camilo','Sebastián','Felipe','Nicolás','Gustavo','Roberto','Omar','Héctor',
    'Arturo','William','Javier','Mauricio','Diego','Pablo'
  ];
  nf text[] := array[
    'María','Carmen','Luz','Gloria','Rosa','Ana','Patricia','Sandra','Claudia','Diana',
    'Marcela','Adriana','Esperanza','Yolanda','Liliana','Paola','Carolina','Alejandra',
    'Natalia','Viviana','Judith','Olga','Rocío','Beatriz','Mónica'
  ];
  ap text[] := array[
    'García','Rodríguez','Martínez','López','Hernández','González','Pérez','Sánchez',
    'Ramírez','Torres','Fuentes','Ríos','Morales','Ortiz','Castro','Vargas','Romero',
    'Mendoza','Aguilar','Vega','Rojas','Navarro','Mora','Cárdenas','Quintero','Parra',
    'Guerrero','Suárez','Pineda','Ramos'
  ];

  v_name    text;
  v_cedula  text;
  v_phone   text;
  v_verif   bool;
  v_vat     timestamptz;
  v_status  vtx_member_status;
  r         record;

begin
  -- ── Candidato raíz ─────────────────────────────────────────────────
  insert into vtx_members (
    parent_id, adhesion_code, full_name, status, region,
    cedula, phone, verified, verified_at
  ) values (
    null, 'VTX-SLVN', 'Silvano Serrano', 'activo', 'Norte de Santander',
    '9100000001', '3175000001', true, now() - interval '90 days'
  ) returning id into v_root;

  -- ── Loop por municipio ─────────────────────────────────────────────
  for r in
    select *
    from (values
      ('54001','Cúcuta',            15, 60, 598, 0.90, 0.75),
      ('54874','Villa del Rosario',  4, 15, 100, 0.88, 0.73),
      ('54405','Los Patios',         3, 12,  89, 0.85, 0.72),
      ('54498','Ocaña',              5, 20, 124, 0.82, 0.70),
      ('54518','Pamplona',           3, 12,  89, 0.83, 0.71),
      ('54810','Tibú',               3, 10,  76, 0.78, 0.68),
      ('54261','El Zulia',           2,  5,  37, 0.80, 0.70),
      ('54720','Sardinata',          2,  6,  51, 0.77, 0.67),
      ('54003','Ábrego',             2,  6,  51, 0.78, 0.68),
      ('54172','Chinácota',          2,  5,  37, 0.79, 0.69),
      ('54553','Puerto Santander',   1,  4,  24, 0.75, 0.66),
      ('54673','San Cayetano',       1,  3,  10, 0.72, 0.65)
    ) as t(muni_cod, muni_nom, n_lid, n_pro, n_sim, p_coord_verif, p_sim_verif)
  loop
    -- ── Coordinador Municipal ──────────────────────────────────────
    v_idx    := v_idx + 1;
    v_cedula := (1001000000 + v_idx)::text;
    v_phone  := '317' || lpad((5000000 + v_idx * 13)::text, 7, '0');
    v_verif  := random() < r.p_coord_verif;
    v_vat    := case when v_verif then now() - (floor(random()*25)::int * interval '1 day') else null end;
    v_name   := nf[1 + (v_idx % array_length(nf, 1))] || ' ' ||
                ap[1 + (v_idx % array_length(ap, 1))] || ' ' ||
                ap[1 + ((v_idx + 9) % array_length(ap, 1))];

    insert into vtx_members (
      parent_id, adhesion_code, full_name, status, region,
      cedula, phone, municipio_codigo, municipio, verified, verified_at
    ) values (
      v_root, vtx_gen_adhesion_code(), v_name, 'activo', 'Norte de Santander',
      v_cedula, v_phone, r.muni_cod, r.muni_nom, v_verif, v_vat
    ) returning id into v_coord;

    -- ── Líderes de Puesto ──────────────────────────────────────────
    lids := '{}';
    for i in 1..r.n_lid loop
      v_idx    := v_idx + 1;
      v_cedula := (1001000000 + v_idx)::text;
      v_phone  := '312' || lpad((4000000 + v_idx * 11)::text, 7, '0');
      v_verif  := random() < (r.p_coord_verif - 0.05);
      v_vat    := case when v_verif then now() - (floor(random()*20)::int * interval '1 day') else null end;
      v_name   := nm[1 + (v_idx % array_length(nm, 1))] || ' ' ||
                  ap[1 + (v_idx % array_length(ap, 1))] || ' ' ||
                  ap[1 + ((v_idx + 5) % array_length(ap, 1))];
      v_status := (array['activo','activo','nuevo']::vtx_member_status[])[1 + floor(random()*3)::int];

      insert into vtx_members (
        parent_id, adhesion_code, full_name, status, region,
        cedula, phone, municipio_codigo, municipio, verified, verified_at
      ) values (
        v_coord, vtx_gen_adhesion_code(), v_name, v_status, 'Norte de Santander',
        v_cedula, v_phone, r.muni_cod, r.muni_nom, v_verif, v_vat
      ) returning id into v_lid;
      lids := lids || v_lid;
    end loop;

    -- ── Promotores ─────────────────────────────────────────────────
    pros := '{}';
    for i in 1..r.n_pro loop
      v_idx    := v_idx + 1;
      v_cedula := (1001000000 + v_idx)::text;
      v_phone  := '300' || lpad((3000000 + v_idx * 7)::text, 7, '0');
      v_verif  := random() < (r.p_sim_verif + 0.05);
      v_vat    := case when v_verif then now() - (floor(random()*15)::int * interval '1 day') else null end;
      v_name   := (case when v_idx % 2 = 0 then nf[1 + (v_idx % array_length(nf, 1))]
                        else nm[1 + (v_idx % array_length(nm, 1))] end) || ' ' ||
                  ap[1 + (v_idx % array_length(ap, 1))] || ' ' ||
                  ap[1 + ((v_idx + 17) % array_length(ap, 1))];
      v_status := (array['activo','activo','nuevo','inactivo']::vtx_member_status[])[1 + floor(random()*4)::int];

      insert into vtx_members (
        parent_id, adhesion_code, full_name, status, region,
        cedula, phone, municipio_codigo, municipio, verified, verified_at
      ) values (
        lids[1 + ((i - 1) % array_length(lids, 1))],
        vtx_gen_adhesion_code(), v_name, v_status, 'Norte de Santander',
        v_cedula, v_phone, r.muni_cod, r.muni_nom, v_verif, v_vat
      ) returning id into v_pro;
      pros := pros || v_pro;
    end loop;

    -- ── Simpatizantes ──────────────────────────────────────────────
    for i in 1..r.n_sim loop
      v_idx    := v_idx + 1;
      v_cedula := (1001000000 + v_idx)::text;
      v_phone  := '310' || lpad((2000000 + v_idx * 3)::text, 7, '0');
      v_verif  := random() < r.p_sim_verif;
      v_vat    := case when v_verif then now() - (floor(random()*10)::int * interval '1 day') else null end;
      v_name   := (case when v_idx % 2 = 0 then nf[1 + (v_idx % array_length(nf, 1))]
                        else nm[1 + (v_idx % array_length(nm, 1))] end) || ' ' ||
                  ap[1 + (v_idx % array_length(ap, 1))] || ' ' ||
                  ap[1 + ((v_idx + 23) % array_length(ap, 1))];
      v_status := (array['activo','nuevo','nuevo','inactivo']::vtx_member_status[])[1 + floor(random()*4)::int];

      insert into vtx_members (
        parent_id, adhesion_code, full_name, status, region,
        cedula, phone, municipio_codigo, municipio, verified, verified_at
      ) values (
        pros[1 + ((i - 1) % array_length(pros, 1))],
        vtx_gen_adhesion_code(), v_name, v_status, 'Norte de Santander',
        v_cedula, v_phone, r.muni_cod, r.muni_nom, v_verif, v_vat
      );
    end loop;

  end loop;

  raise notice 'Seed completado: % miembros + candidato raíz = % total', v_idx, v_idx + 1;
end $$;

-- Restaurar RLS
alter table vtx_members enable row level security;

-- ── Verificación final ──────────────────────────────────────────────────────
select
  count(*)                                                        as total,
  count(*) filter (where verified = true)                        as verificados,
  round(
    count(*) filter (where verified = true)::numeric
    / nullif(count(*), 0) * 100, 1
  )                                                               as pct_verif,
  count(distinct municipio_codigo)                               as municipios
from vtx_members;

select nombre, count(*) as miembros, count(*) filter (where verified) as verif
from vtx_members
join vtx_municipios on vtx_municipios.codigo = vtx_members.municipio_codigo
group by nombre
order by miembros desc;
