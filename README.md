# Seguimiento de obras OICI

Web para ver y seguir las estructuras y obras de la base de Neon que también usan QGIS y QField:
mapa por etapa, hitos para tildar, cuaderno de obra, vencimientos de recepción y filtro "Mis obras".

- Publicada con GitHub Pages: `https://zalogsafull.github.io/seguimiento-obras/`
- Modo demostración, con datos de ejemplo y sin tocar la base: agregá `?demo=1` a la dirección.

## Cómo funciona

- Los datos se leen y escriben con la **Data API de Neon**; el ingreso es con **Neon Auth**.
- En el código no hay contraseñas. `config.js` solo tiene las dos direcciones públicas de Neon.
- La seguridad está en la base (`sql_parte2_web.sql`): solo ven datos los usuarios cargados en
  `usuarios_web`; los `EDITOR` pueden tildar hitos, escribir en el cuaderno y cambiar la situación.

## Dar acceso a una persona

Desde la web: **Usuarios** (botón arriba, solo para administradores).

1. La persona entra a la web y usa **Crear cuenta**.
2. Aparece en *Usuarios > Esperando habilitación*. Elegí su permiso (Editor o Solo lectura) y sus
   iniciales tal como figuran en el campo D.O. (para "Mis obras"), y tocá **Habilitar**.
3. En *Con acceso* se cambia el permiso o las iniciales, o se quita el acceso.

## Base de datos

Los SQL están en `sql/`, en el orden en que se corrieron en Neon. Para la pantalla de usuarios hace
falta `sql/parte3_admin_usuarios.sql`; para agregar puntos, `sql/parte4_puntos_nuevos.sql`; para la capa
Relevamiento, `sql/parte5_relevamiento.sql`; para cambiar la situación y editar los datos de una ficha, `sql/parte7_editar_por_funcion.sql` (la parte 6 quedó reemplazada por esta); para el hito Implantación y las fechas automáticas, `sql/parte8_implantacion.sql`. Después de cada uno: *Data API > Refresh schema cache*.

## Archivos

| Archivo | Para qué |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | La interfaz |
| `api.js` | Lectura y escritura en Neon (y los datos del modo demostración) |
| `config.js` | Direcciones de Neon y plazo de recepción |
| `vendor/` | Cliente de Neon (`@neondatabase/neon-js` 0.9.0-beta empaquetado) y Leaflet 1.9.4 |
