-- =====================================================================
-- PARTE 18 — Las copias de respaldo duran 30 días   (Neon > SQL Editor)
-- Requiere la parte 9 (y la 17, si ya la corriste). No cambia datos de las capas.
--
-- - Los pedidos ya resueltos (borrados, aprobados o rechazados) y su copia de
--   respaldo se borran solos a los 30 días de resueltos.
-- - Los pedidos pendientes no se borran nunca: esperan al administrador.
-- - La limpieza corre sola cada vez que se hace un pedido o un cambio nuevo
--   desde la web; no hace falta programar nada.
-- Para cambiar el plazo, cambiá el 30 en limpiar_respaldos y volvé a correrlo.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.limpiar_respaldos(p_dias integer DEFAULT 30) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_n integer := 0;
  v_m integer := 0;
BEGIN
  DELETE FROM public.solicitudes_borrado
  WHERE estado <> 'PENDIENTE' AND coalesce(resuelto, creado) < now() - make_interval(days => p_dias);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF to_regclass('public.solicitudes_forma') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.solicitudes_forma
             WHERE estado <> ''PENDIENTE'' AND coalesce(resuelto, creado) < now() - make_interval(days => $1)'
      USING p_dias;
    GET DIAGNOSTICS v_m = ROW_COUNT;
  END IF;
  RETURN v_n + v_m;
END $fn$;
REVOKE ALL ON FUNCTION public.limpiar_respaldos(integer) FROM PUBLIC;

-- Se llama sola después de cada pedido o cambio nuevo
CREATE OR REPLACE FUNCTION public.limpiar_respaldos_disparador() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  PERFORM public.limpiar_respaldos(30);
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.limpiar_respaldos_disparador() FROM PUBLIC;

DROP TRIGGER IF EXISTS limpiar_respaldos ON public.solicitudes_borrado;
CREATE TRIGGER limpiar_respaldos AFTER INSERT ON public.solicitudes_borrado
  FOR EACH STATEMENT EXECUTE FUNCTION public.limpiar_respaldos_disparador();

DO $do$
BEGIN
  IF to_regclass('public.solicitudes_forma') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS limpiar_respaldos ON public.solicitudes_forma';
    EXECUTE 'CREATE TRIGGER limpiar_respaldos AFTER INSERT ON public.solicitudes_forma
             FOR EACH STATEMENT EXECUTE FUNCTION public.limpiar_respaldos_disparador()';
  END IF;
END $do$;

COMMIT;

-- Limpieza de una vez de lo que ya tenga más de 30 días, y cuánto ocupa lo que queda
SELECT public.limpiar_respaldos(30) AS pedidos_viejos_borrados,
       pg_size_pretty(pg_total_relation_size('public.solicitudes_borrado')
         + coalesce(pg_total_relation_size(to_regclass('public.solicitudes_forma')), 0)) AS ocupan_los_respaldos;
