-- Fase 2 · Sprint 1 · Verificación de miembros
-- Ejecutar en Supabase SQL Editor

CREATE OR REPLACE FUNCTION vtx_verify_member(p_member_uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_path ltree;
  v_target_path ltree;
BEGIN
  SELECT path INTO v_caller_path
  FROM vtx_members WHERE user_id = auth.uid();

  IF v_caller_path IS NULL THEN
    RAISE EXCEPTION 'No estás registrado en la red';
  END IF;

  SELECT path INTO v_target_path
  FROM vtx_members WHERE id = p_member_uid;

  IF v_target_path IS NULL THEN
    RAISE EXCEPTION 'Miembro no encontrado';
  END IF;

  -- El caller debe ser ancestro del target (su path es prefijo del path del target)
  -- y no puede verificarse a sí mismo
  IF NOT (v_caller_path @> v_target_path AND v_caller_path <> v_target_path) THEN
    RAISE EXCEPTION 'No tienes permiso para verificar este miembro';
  END IF;

  UPDATE vtx_members
  SET verified = TRUE, verified_at = NOW()
  WHERE id = p_member_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION vtx_verify_member(UUID) TO authenticated;
