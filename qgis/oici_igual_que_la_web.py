# -*- coding: utf-8 -*-
# OICI · deja el proyecto de QGIS igual que la web (pegar en la consola de Python y ejecutar).
#
# Qué cambia (solo la presentación; los datos no se tocan):
#  - Árbol de capas: grupo ESTRUCTURAS (Obra, Recepciones, terminadas), grupo OBRAS (Obras)
#    y grupo UTILIDAD (Relevamiento y Departamentos). Las demás capas quedan donde están.
#  - Simbología por reglas, con los mismos nombres, colores, formas y cortes que la web:
#      Obra:         En proyecto · P. ejecutivo aprobado · Hormigonando · Montando · En infraestructura
#      Recepciones:  todas las terminadas sin definitiva → En plazo · 3 a 6 meses · menos de 3 meses
#                    · Vencida · Sin fecha de fin
#      Terminadas:   todas las terminadas → Sin provisoria · Con provisoria · Con definitiva
#      Obras:        En proyecto · Proyecto aprobado · En infraestructura · Terminada (apagada)
#    RECEPCIÓN: RD, PD y PR cuentan como definitiva; RP como provisoria.
#  - Punto rojo chico en las que pasaron su FIN PREVISTO sin terminarse.
#  - Lo que está en obra se dibuja arriba de lo demás.
#  - La simbología anterior queda guardada como estilo "antes de igualar con la web" en cada capa
#    (Propiedades > Simbología > Estilo), por si querés volver.
# Al final guardá el proyecto (Ctrl+S). Para QField, volvé a pasar el proyecto a tus compañeros.
from qgis.core import (QgsFeatureRequest, QgsProject, QgsRuleBasedRenderer, QgsMarkerSymbol, QgsSimpleMarkerSymbolLayer,
                       QgsSimpleMarkerSymbolLayerBase, QgsUnitTypes, QgsMapLayerStyle, QgsLayerTreeLayer,
                       QgsEditorWidgetSetup)
from qgis.PyQt.QtGui import QColor
from qgis.PyQt.QtCore import QPointF

PROJ = QgsProject.instance()
RAIZ = PROJ.layerTreeRoot()

# ---------------------------------------------------------------- expresiones (mismas reglas que la web)
DEF = "(upper(trim(coalesce(\"RECEPCIÓN\",''))) IN ('RD','PD','PR') OR coalesce(\"ETAPA\",1) >= 6)"
PROV = "(upper(trim(coalesce(\"RECEPCIÓN\",''))) = 'RP')"
TERM = "(\"ESTADO\" = 'FIN' OR coalesce(\"ETAPA\",1) >= 5)"
# días que faltan para el vencimiento de la recepción (fin de obra + 730 días)
DIAS = "((epoch(to_date(\"FECHA FIN\")) - epoch(to_date(now()))) / 86400000 + 730)"
ABIERTA = f"NOT {TERM}"
OBRA = [  # etiqueta, filtro, color
    ("En proyecto", f"{ABIERTA} AND coalesce(\"ESTADO\",'') <> 'CONS' AND coalesce(\"ETAPA\",1) < 2", "#f6f6f6"),
    ("P. ejecutivo aprobado", f"{ABIERTA} AND coalesce(\"ESTADO\",'') <> 'CONS' AND coalesce(\"ETAPA\",1) >= 2", "#7ec8f0"),
    ("Hormigonando", f"{ABIERTA} AND \"ESTADO\" = 'CONS' AND coalesce(\"ETAPA\",1) <= 2", "#d7191c"),
    ("Montando", f"{ABIERTA} AND \"ESTADO\" = 'CONS' AND \"ETAPA\" = 3", "#f2d024"),
    ("En infraestructura", f"{ABIERTA} AND \"ESTADO\" = 'CONS' AND \"ETAPA\" >= 4", "#2e9e44"),
]
RECEP_BASE = f"{TERM} AND NOT {DEF}"
RECEP = [
    ("Recepción en plazo", f"{RECEP_BASE} AND \"FECHA FIN\" IS NOT NULL AND {DIAS} >= 180", "#8fcf98"),
    ("Recepción en 3 a 6 meses", f"{RECEP_BASE} AND \"FECHA FIN\" IS NOT NULL AND {DIAS} >= 90 AND {DIAS} < 180", "#f2d024"),
    ("Recepción en menos de 3 meses", f"{RECEP_BASE} AND \"FECHA FIN\" IS NOT NULL AND {DIAS} >= 0 AND {DIAS} < 90", "#f08a24"),
    ("Recepción vencida", f"{RECEP_BASE} AND \"FECHA FIN\" IS NOT NULL AND {DIAS} < 0", "#c1272d"),
    ("Recepción sin fecha de fin", f"{RECEP_BASE} AND \"FECHA FIN\" IS NULL", "#bdbdbd"),
]
TERMINADAS = [
    ("Terminada, sin provisoria", f"{TERM} AND NOT {DEF} AND NOT {PROV}", "#c8c8c8"),
    ("Terminada, con provisoria", f"{TERM} AND NOT {DEF} AND {PROV}", "#a9a9a9"),
    ("Terminada, con definitiva", f"{TERM} AND {DEF}", "#838383"),
]
OBRAS = [
    ("En proyecto", "coalesce(\"Estado\",'') NOT IN ('CONS','FIN') AND coalesce(\"ETAPA\",1) < 2", "#f6f6f6", True),
    ("Proyecto aprobado", "coalesce(\"Estado\",'') NOT IN ('CONS','FIN') AND coalesce(\"ETAPA\",1) >= 2", "#7ec8f0", True),
    ("En infraestructura", "\"Estado\" = 'CONS'", "#2e9e44", True),
    ("Terminada", "\"Estado\" = 'FIN'", "#838383", False),
]
ES_MASTIL = "regexp_match(upper(coalesce(\"ESTRUCTURA\",'')), '^M[ÁA]STIL')"
ES_COSITIO = "upper(coalesce(\"Descripción\",'')) = 'COSITIO'"
TAM = 2.6  # mm, igual para todas las capas (la web ya no agranda las de recepción)


def marcador(forma, color, borde, ancho=0.3, tam=TAM):
    s = QgsMarkerSymbol.createSimple({})
    capa = QgsSimpleMarkerSymbolLayer(forma, tam)
    capa.setColor(QColor(color))
    capa.setStrokeColor(QColor(borde))
    capa.setStrokeWidth(ancho)
    s.changeSymbolLayer(0, capa)
    return s


def regla(etiqueta, filtro, simbolo=None, activa=True):
    r = QgsRuleBasedRenderer.Rule(simbolo, 0, 0, filtro, etiqueta)
    r.setActive(activa)
    return r


def borde_de(grupo):
    return {"recepcion": ("#e0c200", 0.45), "cerrada": ("#1a1a1a", 0.3)}.get(grupo, ("#7a7a7a", 0.25))


def reglas_estructura(lista, grupo):
    """Una regla por categoría, con dos hijas: MÁSTIL (triángulo) y MONOPOLO (círculo)."""
    raiz = QgsRuleBasedRenderer.Rule(None)
    borde, ancho = borde_de(grupo)
    for etq, filtro, color in lista:
        padre = regla(etq, filtro)
        padre.appendChild(regla("Mástil", ES_MASTIL, marcador(QgsSimpleMarkerSymbolLayerBase.Triangle, color, borde, ancho)))
        padre.appendChild(regla("Monopolo", "ELSE", marcador(QgsSimpleMarkerSymbolLayerBase.Circle, color, borde, ancho)))
        raiz.appendChild(padre)
    return raiz


def regla_atraso(campo_estado):
    """Punto rojo chico arriba a la derecha cuando pasó el FIN PREVISTO y no está terminada."""
    s = marcador(QgsSimpleMarkerSymbolLayerBase.Circle, "#FF5A4F", "#161616", 0.2, 1.1)
    s.symbolLayer(0).setOffset(QPointF(1.3, -1.3))
    fin = "(\"ESTADO\" = 'FIN' OR coalesce(\"ETAPA\",1) >= 5)" if campo_estado == "ESTADO" else "\"Estado\" = 'FIN'"
    return regla("Fin previsto pasado", f"\"FIN PREVISTO\" IS NOT NULL AND to_date(\"FIN PREVISTO\") < to_date(now()) AND NOT {fin}", s)


def guardar_estilo_anterior(lyr):
    gestor = lyr.styleManager()
    nombre = "antes de igualar con la web"
    if nombre not in gestor.styles():
        estilo = QgsMapLayerStyle()
        estilo.readFromLayer(lyr)
        gestor.addStyle(nombre, estilo)


def aplicar(lyr, raiz, con_atraso, campo_estado, orden=None):
    guardar_estilo_anterior(lyr)
    if con_atraso and lyr.fields().indexOf("FIN PREVISTO") >= 0:
        raiz.appendChild(regla_atraso(campo_estado))
    rend = QgsRuleBasedRenderer(raiz)
    if orden:  # se dibuja último (arriba) lo de mayor valor
        rend.setOrderBy(QgsFeatureRequest.OrderBy([QgsFeatureRequest.OrderByClause(orden, True)]))
        rend.setOrderByEnabled(True)
    lyr.setRenderer(rend)
    if lyr.subsetString():
        print(f"  · {lyr.name()}: tenía el filtro «{lyr.subsetString()}»; lo saco (ahora filtran las reglas)")
        lyr.setSubsetString("")
    lyr.triggerRepaint()
    try:
        iface.layerTreeView().refreshLayerSymbology(lyr.id())
    except NameError:
        pass


def capa(*nombres):
    for n in nombres:
        c = PROJ.mapLayersByName(n)
        if c:
            return c[0]
    return None


VACIADOS = []


def mover(lyr, grupo, pos):
    nodo = RAIZ.findLayer(lyr.id())
    if nodo is None:
        return
    if nodo.parent() is not grupo and nodo.parent() is not RAIZ:
        VACIADOS.append(nodo.parent())
    visible = nodo.itemVisibilityChecked()
    clon = nodo.clone()
    grupo.insertChildNode(pos, clon)
    nodo.parent().removeChildNode(nodo)
    RAIZ.findLayer(lyr.id()).setItemVisibilityChecked(visible)


def grupo(nombre, pos):
    g = RAIZ.findGroup(nombre)
    if g is None:
        g = RAIZ.insertGroup(pos, nombre)
    return g


def principal():
    obra = capa("Estructuras OICI Obra")
    recep = capa("Estructuras OICI Recepciones")
    term = capa("Estructuras OICI (terminadas)", "Estructuras OICI")
    obras = capa("Obras")
    relev = capa("Relevamiento")
    faltan = [n for n, c in [("Estructuras OICI Obra", obra), ("Estructuras OICI Recepciones", recep),
                             ("Estructuras OICI (terminadas)", term), ("Obras", obras)] if c is None]
    if faltan:
        raise Exception("No encuentro estas capas en el proyecto: " + ", ".join(faltan))

    # Simbología
    aplicar(obra, reglas_estructura(OBRA, "obra"), True, "ESTADO",
            "CASE WHEN \"ESTADO\" = 'CONS' THEN 2 WHEN coalesce(\"ETAPA\",1) >= 2 THEN 1 ELSE 0 END")
    aplicar(recep, reglas_estructura(RECEP, "recepcion"), False, "ESTADO")
    aplicar(term, reglas_estructura(TERMINADAS, "cerrada"), False, "ESTADO")
    r = QgsRuleBasedRenderer.Rule(None)
    for etq, filtro, color, activa in OBRAS:
        padre = regla(etq, filtro, activa=activa)
        padre.appendChild(regla("Cositio", ES_COSITIO, marcador(QgsSimpleMarkerSymbolLayerBase.Star, color, "#7a7a7a", 0.25, TAM * 1.4)))
        padre.appendChild(regla("Obra", "ELSE", marcador(QgsSimpleMarkerSymbolLayerBase.Square, color, "#7a7a7a", 0.25)))
        r.appendChild(padre)
    aplicar(obras, r, True, "Estado")
    print("· simbología igual que la web en las 4 capas")

    # Nombre de la capa de terminadas como en la web
    if term.name() != "Estructuras OICI (terminadas)":
        term.setName("Estructuras OICI (terminadas)")
        print("· «Estructuras OICI» ahora se llama «Estructuras OICI (terminadas)»")

    # Árbol: ESTRUCTURAS, OBRAS y UTILIDAD; lo que está en obra arriba (se dibuja encima)
    g_est = grupo("ESTRUCTURAS", 0)
    for i, lyr in enumerate([obra, recep, term]):
        mover(lyr, g_est, i)
    g_obras = grupo("OBRAS", RAIZ.children().index(g_est) + 1)
    mover(obras, g_obras, 0)
    deptos = capa("Departamentos")
    if relev or deptos:  # como "Capas de utilidad" en la web
        g_util = grupo("UTILIDAD", RAIZ.children().index(g_obras) + 1)
        for i, lyr in enumerate([c for c in (relev, deptos) if c]):
            mover(lyr, g_util, i)
    # grupos que quedaron vacíos por estos movimientos
    for g in VACIADOS:
        try:
            if not g.children() and g.parent() is not None:
                g.parent().removeChildNode(g)
        except RuntimeError:
            pass
    print("· árbol: ESTRUCTURAS (Obra, Recepciones, terminadas) · OBRAS · UTILIDAD (Relevamiento, Departamentos)")

    # Nombres del campo ETAPA en el formulario (último hito terminado)
    etapas_e = [("1 · Proyecto", "1"), ("2 · Proyecto aprobado (si está en obra: hormigonando)", "2"),
                ("3 · Hormigonado (montando)", "3"), ("4 · Montado (en infraestructura)", "4"),
                ("5 · Infraestructura finalizada", "5"), ("6 · Recibida", "6")]
    etapas_o = [("1 · Proyecto", "1"), ("2 · Proyecto aprobado (si está en obra: en infraestructura)", "2"),
                ("5 · Infraestructura finalizada", "5")]
    for lyr, val in [(obra, etapas_e), (recep, etapas_e), (term, etapas_e), (obras, etapas_o)]:
        i = lyr.fields().indexOf("ETAPA")
        if i >= 0:
            lyr.setEditorWidgetSetup(i, QgsEditorWidgetSetup("ValueMap", {"map": [{e: v} for e, v in val]}))
    print("\nListo. Revisá el mapa y guardá el proyecto (Ctrl+S).")


try:
    principal()
except Exception as e:
    print(f"\nERROR: {e}\nNo guardes el proyecto; avisame qué dice y lo corrijo.")
