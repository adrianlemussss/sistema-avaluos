# Respaldo y restauración (RNF-08)

## Qué se respalda
La base de datos completa (`avaluos`): tablas, datos y triggers. Los triggers son los que hacen que
`historial_estado` y `auditoria_sistema` sean de solo inserción, así que un respaldo sin ellos no sirve.

## Hacer un respaldo
Desde `backend/`:

    npm run respaldo

Pide la contraseña de `root` de MySQL. Genera `respaldos/avaluos_<fecha>.sql`.
La carpeta `respaldos/` está en `.gitignore`: **nunca se sube a Git**, porque contiene datos y hashes de contraseñas.

## Probar una restauración (CP-10)
La restauración **siempre va a una base nueva**; el script se niega a escribir sobre la base real.

    npm run restaurar -- ..\respaldos\avaluos_<fecha>.sql

Crea (o reemplaza) la base `avaluos_restaurada`. Para verificarla:

1. Comparar los conteos de `solicitud`, `historial_estado`, `auditoria_sistema`, `usuario` y
   `cotizacion_administrativa` entre `avaluos` y `avaluos_restaurada`: deben coincidir.
2. Comprobar que existen 4 triggers en `avaluos_restaurada`.
3. Intentar `DELETE FROM historial_estado;` en la base restaurada: debe fallar con
   `historial_estado es solo-insercion`.

## Recuperarse de una pérdida real
1. Restaurar el último respaldo en una base nueva y verificarla como arriba.
2. Detener el sistema, renombrar o archivar la base dañada y poner la restaurada en su lugar
   (cambiando `DB_NAME` en `.env`).
3. Arrancar el sistema y revisar que las solicitudes recientes estén completas.

## Pendiente de definir con la empresa (P-10)
- Frecuencia (se recomienda diaria) y lugar de almacenamiento (fuera del equipo y con acceso restringido).
- Plazo de conservación de los respaldos, alineado con el aviso de privacidad.
- Responsable de ejecutar y verificar los respaldos.
