-- =====================================================================
-- VÉRTICE · 03_seed.sql  (prefijo vtx_)
-- Candidato raíz + datos de prueba opcionales.
-- =====================================================================

-- Candidato raíz (cabeza de red). parent_id = NULL.
insert into vtx_members (parent_id, adhesion_code, full_name, status, region)
select null, 'VTX-0001', 'Alejandro Marín', 'activo', 'Gobernación'
where not exists (select 1 from vtx_members where parent_id is null);

-- ---------------------------------------------------------------------
-- DATOS DE PRUEBA (opcional). Genera ~200 miembros con la misma forma
-- jerárquica del prototipo: 7 coordinadores y ramificación preferencial.
-- Bórralo o coméntalo en producción real.
-- ---------------------------------------------------------------------
do $$
declare
  v_root_id   uuid;
  v_parent_id uuid;
  i           int;
  nombres   text[] := array['Ana','Luis','María','Carlos','Sofía','José','Camila','Diego','Andrés','Lucía','Mateo','Daniela','Paula','Javier','Gabriela','Tomás','Renata','Emilio','Martina','Catalina','Sara','Julián','Mariana','Óscar','Pablo','Iván','Natalia','Esteban','Carmen','Rodrigo'];
  apellidos text[] := array['García','Rodríguez','Martínez','López','Hernández','González','Pérez','Sánchez','Ramírez','Torres','Flores','Rivera','Gómez','Díaz','Cruz','Morales','Ortiz','Castro','Vargas','Romero','Mendoza','Aguilar','Vega','Rojas','Navarro','Campos','Cortés','Ríos','Luna'];
  v_st vtx_member_status;
begin
  select id into v_root_id from vtx_members where parent_id is null limit 1;

  for i in 1..200 loop
    if i <= 7 then
      v_parent_id := v_root_id;
    else
      select id into v_parent_id
      from vtx_members
      where depth between 1 and 5 and child_count < (16 - depth*2)
      order by random() * (1 + child_count) desc
      limit 1;
      if v_parent_id is null then
        select id into v_parent_id from vtx_members where depth = 1 order by random() limit 1;
      end if;
    end if;

    v_st := (array['activo','activo','activo','nuevo','inactivo'])[1 + floor(random()*5)::int]::vtx_member_status;

    insert into vtx_members (parent_id, adhesion_code, full_name, status, region)
    values (
      v_parent_id,
      vtx_gen_adhesion_code(),
      nombres[1+floor(random()*array_length(nombres,1))::int] || ' ' ||
        apellidos[1+floor(random()*array_length(apellidos,1))::int],
      v_st,
      'Gobernación'
    );
  end loop;
end $$;
