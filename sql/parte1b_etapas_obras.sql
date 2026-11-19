-- =====================================================================
-- PARTE 1b — Etapas también para la capa "Obras"  (después de la parte 1)
-- Mismos hitos que las estructuras: P. ejecutivo -> Hormigonado ->
-- Estructura montada -> Infraestructura terminada (FIN).
-- No borra datos. Si algo falla, no se aplica nada.
-- =====================================================================
BEGIN;

ALTER TABLE public."Obras" ADD COLUMN IF NOT EXISTS "ETAPA" smallint;

INSERT INTO public.plantilla_hitos (capa, orden, nombre, etapa) VALUES
  ('OBRAS', 10, 'Proyecto ejecutivo realizado y aprobado', 2),
  ('OBRAS', 20, 'Hormigonado',                             3),
  ('OBRAS', 30, 'Estructura montada',                      4),
  ('OBRAS', 40, 'Infraestructura terminada (fin de obra)', 5)
ON CONFLICT (capa, orden) DO NOTHING;

-- Etapa 1 por defecto para obras nuevas
DROP TRIGGER IF EXISTS obra_etapa_inicial ON public."Obras";
CREATE TRIGGER obra_etapa_inicial BEFORE INSERT ON public."Obras"
  FOR EACH ROW EXECUTE FUNCTION public.etapa_inicial();

-- Al marcar un hito: actualiza ETAPA y estado en la capa que corresponda
CREATE OR REPLACE FUNCTION public.actualizar_etapa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est   integer := COALESCE(NEW.estructura_id, OLD.estructura_id);
  v_obra  integer := COALESCE(NEW.obra_id, OLD.obra_id);
  v_etapa smallint;
  v_fin   date;
  v_rprov boolean;
BEGIN
  IF v_est IS NOT NULL THEN
    SELECT COALESCE(max(etapa) FILTER (WHERE estado = 'HECHO'), 1),
           max(fecha_real) FILTER (WHERE estado = 'HECHO' AND etapa = 5),
           bool_or(estado = 'HECHO' AND nombre ILIKE 'Recepción provisoria%')
      INTO v_etapa, v_fin, v_rprov
    FROM public.hitos WHERE estructura_id = v_est;

    UPDATE public."Estructuras OICI Obra" o SET
      "ETAPA"  = v_etapa,
      "ESTADO" = CASE WHEN v_etapa >= 5 THEN 'FIN'
                      WHEN v_etapa >= 3 THEN 'CONS'
                      WHEN o."ESTADO" = 'FIN' AND TG_OP <> 'INSERT' THEN 'CONS'
                      ELSE o."ESTADO" END,
      "RECEPCIÓN" = CASE WHEN v_etapa >= 6 THEN 'RD'
                         WHEN v_rprov AND COALESCE(o."RECEPCIÓN",'') = '' THEN 'RP'
                         ELSE o."RECEPCIÓN" END
    WHERE o.fid = v_est;

    IF v_etapa >= 5 AND v_fin IS NOT NULL THEN
      UPDATE public."Estructuras OICI Obra" SET "FECHA FIN" = v_fin
       WHERE fid = v_est AND "FECHA FIN" IS NULL;
    END IF;

  ELSIF v_obra IS NOT NULL THEN
    SELECT COALESCE(max(etapa) FILTER (WHERE estado = 'HECHO'), 1)
      INTO v_etapa
    FROM public.hitos WHERE obra_id = v_obra;

    UPDATE public."Obras" o SET
      "ETAPA"  = v_etapa,
      "Estado" = CASE WHEN v_etapa >= 5 THEN 'FIN'
                      WHEN v_etapa >= 3 THEN 'CONS'
                      WHEN o."Estado" = 'FIN' AND TG_OP <> 'INSERT' THEN 'CONS'
                      ELSE o."Estado" END
    WHERE o.fid = v_obra;
  END IF;
  RETURN NULL;
END $$;

-- Hitos para las obras que ya existen, marcados según su estado actual
INSERT INTO public.hitos (obra_id, orden, nombre, etapa, estado)
SELECT o.fid, p.orden, p.nombre, p.etapa,
  CASE WHEN o."Estado" = 'FIN'  AND p.etapa <= 5 THEN 'HECHO'
       WHEN o."Estado" = 'CONS' AND p.etapa <= 2 THEN 'HECHO'
       ELSE 'PENDIENTE' END
FROM public."Obras" o
CROSS JOIN public.plantilla_hitos p
WHERE p.capa = 'OBRAS'
  AND NOT EXISTS (SELECT 1 FROM public.hitos h WHERE h.obra_id = o.fid);

UPDATE public."Obras" SET "ETAPA" = 1 WHERE "ETAPA" IS NULL;

-- La vista web suma la etapa (columna nueva al final)
CREATE OR REPLACE VIEW public.v_obras WITH (security_invoker = true) AS
SELECT
  o.fid AS id, o."CÓDIGO" AS codigo, o."Estado" AS estado, o."Sala" AS sala,
  o."Localidad" AS localidad, o."Departamento" AS departamento,
  o."Licitación" AS licitacion, o."Tarea" AS tarea, o."Descripción" AS descripcion,
  o."D.O." AS director_obra, o."Planos" AS planos,
  ST_Y(ST_Transform(o.geom, 4326)) AS lat, ST_X(ST_Transform(o.geom, 4326)) AS lon,
  (SELECT count(*) FROM public.hitos h WHERE h.obra_id = o.fid AND h.estado = 'HECHO')      AS hitos_hechos,
  (SELECT count(*) FROM public.hitos h WHERE h.obra_id = o.fid AND h.estado <> 'NO APLICA') AS hitos_total,
  (SELECT min(COALESCE(h.recordatorio, h.fecha_prevista)) FROM public.hitos h
     WHERE h.obra_id = o.fid AND h.estado IN ('PENDIENTE','EN CURSO'))                    AS proximo_vencimiento,
  o."ETAPA" AS etapa
FROM public."Obras" o;

COMMIT;
