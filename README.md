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

1. Que entre a la web y use **Crear cuenta**.
2. En Neon > SQL Editor, buscá su id: `SELECT id, email FROM neon_auth."user";`
3. Autorizala:

```sql
INSERT INTO public.usuarios_web (user_id, nombre, rol, iniciales_do)
VALUES ('ID_COPIADO', 'Nombre', 'EDITOR', 'G.S.');   -- o 'LECTOR'
```

`iniciales_do` tiene que coincidir con el campo D.O. de las capas para que funcione "Mis obras".

## Archivos

| Archivo | Para qué |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | La interfaz |
| `api.js` | Lectura y escritura en Neon (y los datos del modo demostración) |
| `config.js` | Direcciones de Neon y plazo de recepción |
| `vendor/` | Cliente de Neon (`@neondatabase/neon-js` 0.9.0-beta empaquetado) y Leaflet 1.9.4 |
