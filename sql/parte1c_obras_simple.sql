-- =====================================================================
-- PARTE 1c — Obras: etapas simplificadas
--   Proyecto -> Proyecto aprobado -> Obra de infraestructura -> FIN
-- (sin hormigonado ni montaje). Solo toca hitos de la capa "Obras".
-- =====================================================================
BEGIN;

DELETE FROM public.plantilla_hitos WHERE capa = 'OBRAS';
INSERT INTO public.plantilla_hitos (capa, orden, nombre, etapa) VALUES
  ('OBRAS', 10, 'Proyecto aprobado',                       2),
  ('OBRAS', 20, 'Infraestructura terminada (fin de obra)', 5);

-- Hitos de obras existentes: se quitan hormigonado y montaje, se renombra el proyecto
DELETE FROM public.hitos
 WHERE obra_id IS NOT NULL AND nombre IN ('Hormigonado', 'Estructura montada');
UPDATE public.hitos SET nombre = 'Proyecto aprobado', orden = 10
 WHERE obra_id IS NOT NULL AND nombre = 'Proyecto ejecutivo realizado y aprobado';
UPDATE public.hitos SET orden = 20
 WHERE obra_id IS NOT NULL AND nombre = 'Infraestructura terminada (fin de obra)';

COMMIT;
