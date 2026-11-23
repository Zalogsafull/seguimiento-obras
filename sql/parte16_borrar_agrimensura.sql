-- =====================================================================
-- PARTE 16 — Borrar mojones, triángulos y padrones desde la web   (Neon > SQL Editor)
-- Requiere las partes 9 y 15. No cambia datos ni contraseñas.
-- Después de correrlo: Neon > Data API > "Refresh schema cache".
--
-- Igual que con las estructuras: un administrador borra directamente; un editor
-- deja el pedido y un administrador lo aprueba o lo rechaza. Antes de borrar se
-- guarda una copia completa en solicitudes_borrado.respaldo.
-- =====================================================================
BEGIN;

ALTER TABLE public.solicitudes_borrado DROP CONSTRAINT IF EXISTS solicitudes_borrado_tipo_check;
ALTER TABLE public.solicitudes_borrado ADD CONSTRAINT solicitudes_borrado_tipo_check
  CHECK (tipo IN ('estructura', 'obra', 'relevamiento', 'amojonamiento', 'triangulo', 'padron'));

-- Tabla de cada tipo (ahora con las tres capas de agrimensura)
CREATE OR REPLACE FUNCTION public.tabla_de_tipo(p_tipo text) RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE p_tipo WHEN 'estructura' THEN 'Estructuras OICI Obra' WHEN 'obra' THEN 'Obras'
                     WHEN 'relevamiento' THEN 'Relevamiento' WHEN 'amojonamiento' THEN 'Amojonamiento'
                     WHEN 'triangulo' THEN 'Triangulos' WHEN 'padron' THEN 'Padrones' END
$fn$;

-- Pedido de borrado: el nombre que se guarda es el código (o "Padrón N" en Padrones)
CREATE OR REPLACE FUNCTION public.pedir_borrado(p_tipo text, p_id integer, p_motivo text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_tabla  text;
  v_fila   jsonb;
  v_codigo text;
  v_nombre text;
  v_resp   jsonb;
BEGIN
  IF coalesce(public.rol_web(), '') <> 'EDITOR' THEN
    RAISE EXCEPTION 'Solo un usuario con permiso de editor puede pedir que se borre algo';
  END IF;
  v_tabla := public.tabla_de_tipo(p_tipo);
  IF v_tabla IS NULL THEN
    RAISE EXCEPTION 'Capa desconocida: %', p_tipo;
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE fid = $1', v_tabla) INTO v_fila USING p_id;
  IF v_fila IS NULL THEN
    RAISE EXCEPTION 'Ya no existe: puede que otra persona lo haya borrado';
  END IF;
  v_codigo := nullif(coalesce(v_fila->>'CÓDIGO',
                              CASE WHEN v_fila ? 'PADRON' THEN 'Padrón ' || coalesce(v_fila->>'PADRON', 'sin número') END, ''), '');
  SELECT nombre INTO v_nombre FROM public.usuarios_web WHERE user_id = auth.user_id();

  IF public.es_admin() THEN
    v_resp := public.borrar_elemento(p_tipo, p_id);
    INSERT INTO public.solicitudes_borrado (tipo, objeto_id, codigo, motivo, pedido_por, pedido_nombre,
                                            estado, resuelto_por, resuelto, respaldo)
    VALUES (p_tipo, p_id, v_codigo, p_motivo, auth.user_id(), v_nombre, 'BORRADA', auth.user_id(), now(), v_resp);
    RETURN 'BORRADO';
  END IF;

  IF EXISTS (SELECT 1 FROM public.solicitudes_borrado
             WHERE tipo = p_tipo AND objeto_id = p_id AND estado = 'PENDIENTE') THEN
    RETURN 'YA_PEDIDO';
  END IF;
  INSERT INTO public.solicitudes_borrado (tipo, objeto_id, codigo, motivo, pedido_por, pedido_nombre)
  VALUES (p_tipo, p_id, v_codigo, nullif(trim(p_motivo), ''), auth.user_id(), v_nombre);
  RETURN 'PEDIDO';
END $fn$;

REVOKE ALL ON FUNCTION public.pedir_borrado(text, integer, text), public.tabla_de_tipo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pedir_borrado(text, integer, text) TO authenticated;

COMMIT;

-- Control: tiene que decir Amojonamiento, Triangulos y Padrones
SELECT public.tabla_de_tipo('amojonamiento') AS mojones, public.tabla_de_tipo('triangulo') AS triangulos,
       public.tabla_de_tipo('padron') AS padrones;
