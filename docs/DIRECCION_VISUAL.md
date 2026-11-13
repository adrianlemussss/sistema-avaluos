# Dirección visual — Empresa Valuadora

Identidad: Empresa Valuadora de Inmuebles, Industrias y Maquinaria S. A. de C.V. Forma corta: Empresa Valuadora. Monograma V provisional para el prototipo.
Concepto: lujo institucional, patrimonio y precisión técnica. Noche #101f2a, marfil #f4f2ec, papel #fdfcf8, bronce #927449. Georgia editorial en titulares; Segoe UI/sans-serif en datos e interfaces. Fuentes locales.
Portada asimétrica, especialidades numeradas, equipo y contacto. Acceso editorial. Sistema interno con navegación noche, indicadores tipográficos, tablas y formularios claros. Gráficos y estados con textos además de color, transiciones breves, movimiento reducido y adaptación móvil.

## Imagen

Imagen conceptual generada con la herramienta integrada de imágenes. No representa una sede, proyecto ni cliente real. Archivo: frontend/assets/arquitectura-editorial.png.
Prompt: fotografía editorial de fachada contemporánea de piedra cálida y aletas de bronce, perspectiva oblicua, cielo azul noche, luz lateral, composición asimétrica, sin personas, logotipos ni texto.
No se inventan certificaciones, clientes, años de experiencia ni contactos. Faltan enlaces oficiales de redes y contacto.

## Equipo y permisos

El usuario confirmó: página pública + conservar sistema interno; por ahora solo adaptar nombres y diseño.
Personas internas descritas: Orlando (dirección, acuerdos, firma y avalúos), Daniela (proyectos pequeños y documentación asignados por el ingeniero), Xiuhtémoc (capacitación y apoyo de proyectos/documentación). Clientes, contadora y abogados no forman parte del equipo interno descrito; esto no elimina sus posibles interacciones externas.
Los cuatro perfiles técnicos y todas las cuentas actuales permanecen. Alias visuales exactos mediante nombreVisible, sin modificar la base:

- Socio A (ficticio) → Ingeniero Orlando; socio.a@demo.test, perfil socio.
- Asistente (ficticia) → Administradora Daniela; asistente@demo.test, perfil asistente.
- Admin tecnico (ficticio) → Administrador Xiuhtémoc; admin@demo.test, perfil admin.
  Estos alias son de presentación del prototipo, no definen ni validan permisos definitivos. En particular, admin sigue limitado a usuarios/auditoría, sin adquirir las tareas de Daniela.
  Una adaptación funcional a tres actores requiere acordar una matriz de permisos. No se implementan carga/corrección de documentos, firma electrónica, capacitación, nuevas asignaciones ni generación automática de avalúos.

## Verificación de esta entrega
- Sintaxis de todos los archivos JavaScript del frontend: correcta con node --check.
- git diff --check: sin errores de espacios.
- /api/health: {"ok":true}, conectado con MySQL.
- Revisión visual real en navegador: escritorio 1440×1000 y móvil 390×844. Portada e imagen cargadas; portada y reportes sin desbordamiento horizontal de la página.
- Acceso comprobado con asistente y administrador; nombres visuales Daniela y Xiuhtémoc. Orlando también aparece en responsables y tabla de usuarios.
- Búsqueda por "renta": 1 de 8 solicitudes; apertura del detalle comprobada. Reportes con los datos existentes; formulario y tabla de usuarios cargados. Menú móvil, cierre y etiquetas asociadas de formularios revisados.
- No se ejecutó la suite de integración que crea usuarios en avaluos_test: no hubo cambios de backend ni esquema. No se realizaron operaciones de crear, asignar, cancelar o cambiar permisos durante la revisión.
