# Sistema web de gestión y seguimiento de solicitudes de avalúo

Proyecto académico UPIICSA (Diseño de Proyectos de Sistemas Informáticos, 8CV81).
Registra solicitudes de avalúo, las asigna a un socio, da seguimiento por estados con historial
auditable y separa la cartera de cada socio.

> Solo datos **ficticios**. El proyecto no valúa, no cotiza automáticamente y no almacena documentos.
> Las decisiones que dependen de la empresa están marcadas en el código y en `docs/ROLES_Y_PERMISOS.md`
> con su identificador del Anexo D (P-04, P-05, P-07, P-08...).

## Requisitos
- **Node.js 22 o superior** (probado con la 24). Comprueba con `node -v`.
- **MySQL 8 o superior** (MySQL, **no** MariaDB ni XAMPP). Comprueba con `mysql --version`.
- **Git**.

## Instalación (una sola vez)

### 1. Clonar
```bash
git clone https://github.com/adrianlemussss/sistema-avaluos.git
cd sistema-avaluos
```

### 2. Crear la base de datos y su usuario
Entra a MySQL como administrador (`mysql -u root -p`) y ejecuta, **eligiendo tu propia contraseña**:

```sql
CREATE DATABASE avaluos CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'avaluos_app'@'localhost' IDENTIFIED BY 'ELIGE_UNA_CLAVE';
GRANT SELECT, INSERT, UPDATE, DELETE ON avaluos.* TO 'avaluos_app'@'localhost';
```

Carga el esquema (tablas, triggers y catálogos). **Solo en una base nueva: borra todo lo que haya.**

```bash
mysql -u root -p avaluos < database/schema.sql
```

En Windows PowerShell el símbolo `<` no funciona; usa: `cmd /c "mysql -u root -p avaluos < database\schema.sql"`.

### 3. Configurar el backend
```bash
cd backend
npm install
```

Copia `.env.example` a `.env` (`copy .env.example .env` en Windows, `cp` en Mac o Linux) y completa:

| Variable | Qué poner |
|---|---|
| `PORT` | `3000` |
| `NODE_ENV` | `development` |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` |
| `DB_USER` / `DB_PASSWORD` | `avaluos_app` y la clave que elegiste en el paso 2 |
| `DB_NAME` | `avaluos` |
| `SESSION_SECRET` | Cadena larga y aleatoria. Genérala con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ASISTENTE_ACCESO_GLOBAL` | `true` (supuesto P-07: la asistente ve todas las solicitudes) |
| `SEED_PASSWORD` | Contraseña de las cuentas demo, **mínimo 12 caracteres**. Si lleva `#`, ponla entre comillas |

**Nunca subas `.env` a Git** (ya está en `.gitignore`).

### 4. Cuentas y datos de demostración
```bash
npm run seed        # crea las 6 cuentas demo con SEED_PASSWORD
npm run seed-demo   # crea 8 solicitudes ficticias en distintos estados (opcional)
```

### 5. Levantar el sistema
```bash
npm run dev
```
Abre http://localhost:3000. Comprobación rápida: http://localhost:3000/api/health debe mostrar `{"ok":true}`.

> **Windows PowerShell:** si `npm` da error de "ejecución de scripts deshabilitada", usa `npm.cmd` en vez de `npm`.

## Cuentas demo (contraseña = tu `SEED_PASSWORD`)
| Rol | Correo |
|---|---|
| Cliente | `cliente1@demo.test`, `cliente2@demo.test` |
| Socio | `socio.a@demo.test`, `socio.b@demo.test` |
| Asistente | `asistente@demo.test` |
| Administrador técnico | `admin@demo.test` |

Si cambias `SEED_PASSWORD` después, ejecuta `npm run reset-demo` para actualizar las 6 cuentas.

## Comandos (desde `backend/`)
| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con reinicio automático al guardar |
| `npm start` | Servidor sin reinicio automático |
| `npm test` | 16 pruebas de integración contra la base `avaluos_test` |
| `npm run seed` | Crea las cuentas demo |
| `npm run seed-demo` | Crea solicitudes de ejemplo (no duplica) |
| `npm run reset-demo` | Pone `SEED_PASSWORD` a las cuentas demo |
| `npm run respaldo` | Copia de seguridad de la base (ver `docs/RESPALDO.md`) |
| `npm run restaurar -- <archivo.sql>` | Restaura un respaldo en una base nueva |

## Pruebas automáticas
Usan una base **aparte** (`avaluos_test`) y se niegan a correr contra otra. Preparación, una sola vez:

```bash
mysql -u root -p < database/test_setup.sql
mysql -u root -p avaluos_test < database/schema.sql
cd backend
npm test
```

Cada corrida crea sus propios usuarios, así que no hay que limpiar la base entre ejecuciones.

## Estructura
```
backend/
  src/
    app.js            Aplicación Express (middlewares y rutas)
    server.js         Arranque
    db.js             Conexión a MySQL (lee .env)
    routes/           Una ruta por tema (auth, solicitudes, flujo, compartir, cotizaciones...)
    services/         Reglas: estados, acceso por objeto, utilidades comunes, almacén de sesiones
    middleware/       Autenticación y roles
  scripts/            seed, seed-demo, reset-demo, respaldo, restaurar
  test/               Pruebas de integración
database/             schema.sql, migraciones y preparación de la base de pruebas
frontend/             HTML, CSS y JavaScript (Bootstrap solo en CSS)
docs/                 Documentación del proyecto
```

## API
Todas las rutas empiezan con `/api`. Las que cambian datos solo aceptan `Content-Type: application/json`.

| Ruta | Quién | Para qué |
|---|---|---|
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Todos | Sesión |
| `GET /catalogos` | Con sesión | Tipos, estados y orígenes |
| `GET /clientes` | Asistente | Lista de clientes |
| `GET /socios` | Asistente, socio | Lista de socios |
| `GET`, `POST /solicitudes` | Cliente, socio, asistente (crear: cliente y asistente) | Listar y registrar |
| `GET /solicitudes/:id` y `/:id/detalle` | Quien la vea | Detalle y acciones permitidas |
| `GET /solicitudes/:id/historial` | Socio, asistente | Historial de estados |
| `POST /solicitudes/:id/asignar` | Asistente | Asignar a un socio |
| `POST /solicitudes/:id/estado` | Socio dueño; asistente solo para cancelar en Recibida | Cambiar estado |
| `POST`, `DELETE /solicitudes/:id/compartir` | Socio dueño | Compartir o quitar acceso |
| `GET`, `POST /solicitudes/:id/cotizaciones` y `/:idCot/estatus` | Socio dueño | Cotización administrativa |
| `POST /solicitudes/:id/referencia` | Socio dueño | Referencia de entrega |
| `GET /reportes/resumen` | Socio, asistente | Conteos por estado, tipo, responsable y mes |
| `GET`, `POST /usuarios`, `POST /usuarios/:id/rol` y `/activo` | Admin | Gestión de usuarios |
| `GET /auditoria` | Admin | Eventos de permisos, cotizaciones y usuarios |
| `GET /health` | Público | Comprobación |

Un recurso ajeno responde **404**, no 403, para no revelar que existe.

## Flujo de trabajo en equipo (Git)
- Antes de empezar: `git pull`.
- Cada quien trabaja en una rama `feature/<tema>` y abre un Pull Request hacia `main`; otro integrante lo revisa.
- Commits pequeños y claros. **Nunca subir `.env`**: revisa `git status` antes de cada commit.
- Si cambia la base de datos: agrega un archivo en `database/migrations/` y actualiza `database/schema.sql`. No pidas a nadie ejecutar `schema.sql` sobre una base con datos.
- Antes de subir, corre `npm test`: debe dar 0 fallos.

## Seguridad (resumen)
Contraseñas con bcrypt; consultas SQL parametrizadas; autorización por objeto en el servidor;
cabeceras de seguridad con helmet; cookie de sesión `httpOnly` y `sameSite`; sesiones guardadas en MySQL;
límite de 10 inicios de sesión fallidos cada 15 minutos; bitácoras de solo inserción (triggers).

## Limitaciones y pendientes
- **HTTPS** se exige solo en producción (`NODE_ENV=production`); en local se sirve por http.
- No existe pantalla para **cambiar la contraseña** ni para que el admin la **restablezca**.
- La tabla `cliente_socio` está reservada y todavía no se usa: la cartera se define por `solicitud.id_socio`.
- No se implementan reapertura, reasignación ni pausa de solicitudes (P-04).
- Publicar en un dominio real requiere autorización de la empresa y revisión de datos y seguridad.
- Frecuencia y conservación de respaldos pendientes de acordar con la empresa (P-10).
