# Roles y permisos

El servidor decide siempre. Ocultar un botón en pantalla no es una protección. Un recurso ajeno responde
**404** (no 403) para no revelar que existe. El rol y el estado de la cuenta se revisan en la base **en cada
petición**, así que una baja o un cambio de rol se aplican de inmediato.

## Matriz
| Función | Cliente | Socio dueño | Socio con acceso compartido | Asistente | Admin técnico |
|---|---|---|---|---|---|
| Registrar solicitud | Sí (origen web) | No | No | Sí, a nombre de un cliente | No |
| Ver solicitudes | Solo las suyas | Las de su cartera | Solo las compartidas | Todas (P-07) | No |
| Ver historial | Solo estados y fechas | Completo | Completo | Completo | No |
| Asignar a un socio | No | No | No | Sí | No |
| Cambiar estado | No | Sí | No | Solo cancelar en Recibida | No |
| Compartir y quitar acceso | No | Sí (P-05) | No | No | No |
| Cotización (ver y registrar) | No | Sí | No | No | No |
| Referencia de entrega (registrar) | No | Sí, al entregar | No | No | No |
| Ver referencia de entrega | Sí | Sí | Sí | Sí | No |
| Reportes | No | De lo que ve | De lo que ve | De todo, con filtro por socio | No |
| Gestión de usuarios | No | No | No | No | Sí |
| Auditoría | No | No | No | No | Sí |

El administrador técnico **no ve datos comerciales** (solicitudes, precios): su función es técnica.

## Reglas de protección
- Un admin no puede cambiarse el rol ni desactivarse a sí mismo; siempre debe quedar al menos un admin activo.
- Solo el admin crea usuarios, y solo él puede crear otros administradores.
- Las bitácoras (`historial_estado` y `auditoria_sistema`) no se pueden editar ni borrar, ni siquiera con root.
- Inicio de sesión: 10 intentos fallidos cada 15 minutos por conexión; mensaje genérico para no revelar qué correos existen.

## Supuestos pendientes de validar con la empresa
| ID | Qué se asumió | Dónde está |
|---|---|---|
| P-04 | Transiciones: Recibida → Asignada o Cancelada; Asignada → En proceso o Cancelada; En proceso → Entregada o Cancelada; Entregada y Cancelada sin cambio. No hay reapertura, reasignación ni pausa. | `backend/src/services/estados.js` |
| P-05 | El permiso compartido es por solicitud individual, de solo consulta, y solo el socio dueño lo da. | `backend/src/routes/compartir.js` |
| P-07 | La asistente ve todas las solicitudes (`ASISTENTE_ACCESO_GLOBAL=true`) y es la única que asigna. | `backend/src/services/acceso.js` |
| P-08 | Los clientes tienen cuenta y consultan sus solicitudes. Falta confirmar si conviene a clientes ocasionales. | `frontend/` |
| RF-11 | Solo el socio dueño ve y registra los precios; ningún otro rol los ve. | `backend/src/routes/cotizaciones.js` |
| P-10 | Aviso de privacidad, finalidad y plazos de conservación de datos y respaldos. | `docs/RESPALDO.md` |
