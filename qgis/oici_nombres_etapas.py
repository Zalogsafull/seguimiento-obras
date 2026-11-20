# Nombres parejos en QGIS (pegar en la consola de Python de QGIS y ejecutar).
# - Leyenda (simbología): la etapa dice lo que se está haciendo -> Hormigonando, Montando...
# - Campo ETAPA (formulario): guarda el último hito terminado -> Hormigonado, Montado...
# No cambia datos: solo nombres en la simbología y en el formulario. Al final, guardá el proyecto.
from qgis.core import QgsProject, QgsRuleBasedRenderer, QgsEditorWidgetSetup

PREFIJO = "Etapa · "
LEYENDA = {
    "Proyecto": "En proyecto",
    "Hormigonado": "Hormigonando",
    "Montaje": "Montando",
    "Obra de infraestructura": "En infraestructura",
}
ETAPA_ESTRUCTURAS = [("1 · Proyecto", "1"),
                     ("2 · Proyecto aprobado (si está en obra: hormigonando)", "2"),
                     ("3 · Hormigonado (montando)", "3"),
                     ("4 · Montado (en infraestructura)", "4"),
                     ("5 · Infraestructura finalizada", "5"),
                     ("6 · Recibida", "6")]
ETAPA_OBRAS = [("1 · Proyecto", "1"),
               ("2 · Proyecto aprobado (si está en obra: en infraestructura)", "2"),
               ("5 · Infraestructura finalizada", "5")]


def renombrar_reglas(regla):
    n = 0
    for r in regla.children():
        etq = r.label()
        if etq.startswith(PREFIJO) and etq[len(PREFIJO):] in LEYENDA:
            r.setLabel(PREFIJO + LEYENDA[etq[len(PREFIJO):]])
            n += 1
        n += renombrar_reglas(r)
    return n


cambios = 0
for lyr in QgsProject.instance().mapLayers().values():
    if lyr.type() != lyr.VectorLayer:
        continue
    rend = lyr.renderer()
    if isinstance(rend, QgsRuleBasedRenderer):
        n = renombrar_reglas(rend.rootRule())
        if n:
            cambios += n
            lyr.triggerRepaint()
            try:
                iface.layerTreeView().refreshLayerSymbology(lyr.id())
            except NameError:
                pass
            print(f"· {lyr.name()}: {n} nombres de la leyenda")
    i = lyr.fields().indexOf("ETAPA")
    if i >= 0:
        es_obras = "Estructuras" not in (lyr.source() + lyr.name())
        valores = ETAPA_OBRAS if es_obras else ETAPA_ESTRUCTURAS
        lyr.setEditorWidgetSetup(i, QgsEditorWidgetSetup("ValueMap", {"map": [{e: v} for e, v in valores]}))
        print(f"· {lyr.name()}: nombres del campo ETAPA")
print(f"Listo ({cambios} cambios en la leyenda). Guardá el proyecto (Ctrl+S).")
