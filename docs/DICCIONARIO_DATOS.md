# Diccionario de datos

Motor MySQL 8, InnoDB, `utf8mb4`. Todas las fechas se guardan en **UTC**; la pantalla las muestra en la hora local.

## rol
| Columna | Tipo | Descripción |
|---|---|---|
| id_rol | TINYINT, PK | 1 cliente, 2 socio, 3 asistente, 4 admin |
| nombre | VARCHAR(20), único | Nombre del rol |

## usuario
| Columna | Tipo | Descripción |
|---|---|---|
| id_usuario | BIGINT, PK | Identificador |
| email | VARCHAR(190), único | Correo; se guarda en minúsculas |
| nombre | VARCHAR(120) | Nombre visible |
| password_hash | VARCHAR(100) | Hash bcrypt (nunca texto plano) |
| id_rol | FK rol | Rol actual |
| activo | TINYINT(1) | 1 activo, 0 baja lógica |
| creado_en | DATETIME(3) | Alta, en UTC |

## socio
Perfil de un usuario con rol socio: `id_socio` (PK) y `id_usuario` (FK única). Es el dueño de una cartera.

## cliente
| Columna | Tipo | Descripción |
|---|---|---|
| id_cliente | BIGINT, PK | Identificador |
| id_usuario | FK usuario, única, opcional | Cuenta con la que consulta; puede ser nula |
| nombre, telefono, email | texto | Datos mínimos de contacto |
| creado_en | DATETIME(3) | Alta |

## cliente_socio
Reservada para una futura relación muchos a muchos entre clientes y socios. **Hoy no se usa.**

## tipo_avaluo
Catálogo: Comercial, Judicial, Fiscal, Catastral, Crédito. Columnas `id_tipo` y `nombre`.

## estado
Catálogo fijo de **5** estados: 1 Recibida, 2 Asignada, 3 En proceso, 4 Entregada, 5 Cancelada.

## solicitud
| Columna | Tipo | Descripción |
|---|---|---|
| id_solicitud | BIGINT, PK | Identificador |
| folio | VARCHAR(20), único | Formato `AV-AAAA-XXXXXX` |
| id_cliente | FK cliente | Quién la pidió |
| id_tipo | FK tipo_avaluo | Modalidad |
| id_socio | FK socio, nulo | Responsable; nulo hasta asignarla |
| id_estado | FK estado | Estado actual |
| origen | ENUM | whatsapp, llamada, recomendacion, empresa, web |
| proposito | VARCHAR(255) | Para qué se requiere el avalúo |
| descripcion_bien | VARCHAR(255) | Descripción breve del inmueble |
| referencia_entrega | VARCHAR(120), nulo | Referencia administrativa al entregar (texto, sin archivos) |
| creada_en | DATETIME(3) | Alta, en UTC |

## asignacion
Registro de cada asignación: `id_solicitud`, `id_socio`, `id_usuario_asigna` y `asignada_en`.

## cotizacion_administrativa
| Columna | Tipo | Descripción |
|---|---|---|
| id_cotizacion | BIGINT, PK | Identificador |
| id_solicitud | FK solicitud | A qué solicitud pertenece |
| importe | DECIMAL(12,2) | Pesos, capturado a mano; el sistema no calcula valores |
| estatus | ENUM | propuesta, acordada, cancelada |
| registrada_por | FK usuario | Quién la capturó |
| creada_en | DATETIME(3) | Alta |

## permiso_compartido
Acceso de **solo consulta** de otro socio a **una solicitud concreta**.
`id_solicitud`, `id_socio_destino`, `autorizado_por`, `otorgado_en`, `revocado_en` y `revocado_por`.
Está vigente mientras `revocado_en` sea nulo.

## historial_estado (solo inserción)
| Columna | Tipo | Descripción |
|---|---|---|
| id_historial | BIGINT, PK | No reutilizable |
| id_solicitud | FK solicitud | Solicitud afectada |
| estado_anterior | FK estado, nulo | Nulo solo en la creación |
| estado_nuevo | FK estado | Uno de los 5 estados |
| id_usuario_actor | FK usuario | Quién hizo el cambio |
| fecha_hora_utc | DATETIME(6) | La genera el servidor, no el navegador |
| motivo | VARCHAR(255), nulo | Obligatorio al cancelar |
| tipo_evento | ENUM | creacion, transicion, correccion_autorizada |

Los triggers rechazan `UPDATE` y `DELETE` con el mensaje `historial_estado es solo-insercion`.

## auditoria_sistema (solo inserción)
Eventos de permisos, cotizaciones, referencias y usuarios.
Columnas: `tipo_evento`, `id_usuario_actor`, `id_solicitud` (nulo), `id_usuario_objetivo` (nulo), `detalle` y `fecha_hora_utc`.
**No guarda importes ni contraseñas.** Tipos: PERMISO_OTORGADO, PERMISO_REVOCADO, COTIZACION_REGISTRADA,
COTIZACION_ESTATUS, REFERENCIA_REGISTRADA, USUARIO_CREADO, USUARIO_ROL, USUARIO_ACTIVO.
Mismos triggers de solo inserción.

## sesion
Sesiones de inicio de sesión: `sid` (PK), `datos` (JSON con id, rol y nombre; sin contraseñas) y `expira`.
Se borran al vencer (8 horas desde el inicio de sesión).
