# Plan de Pruebas UAT — Gemswell MIS

**Producto:** Gemswell Ventures MIS (Management Information System)
**Cartera:** Madrid Playa Surf (`MAD`) · Birmingham (`BHX`) · y corpus documental de Kelpa (`KLP`), fondo (`PHILAE`) y portfolio (`GVF`)
**Audiencia:** Equipo Gemswell + stakeholders (probadores humanos)
**Versión app:** v0.2 · Entorno: producción tras el cutover de autenticación C1
**Tipo de prueba:** Aceptación de usuario (UAT) — funcional, manual, sin conocimientos técnicos

---

## 1. Cómo usar este documento

Cada caso de prueba tiene:

- **ID** — identificador único (p. ej. `CP-LOGIN-01`).
- **Objetivo** — qué validamos.
- **Precondiciones** — qué debe cumplirse antes de empezar.
- **Pasos** — acciones numeradas a ejecutar, una a una.
- **Resultado esperado** — lo que la aplicación debe mostrar/hacer.
- **Estado** — el probador escribe **OK** (correcto), **KO** (falla) o **N.A.** (no aplica).
- **Observaciones** — notas, capturas, número de incidencia.

> **Importante:** rellena la columna *Estado* en TODOS los casos. Si marcas **KO**, describe en *Observaciones* qué pasó realmente, con captura si es posible.

### Datos de acceso (precondición general para casi todo)

- Toda la aplicación exige sesión iniciada. Sin login, cualquier página redirige a `/login` y cualquier llamada interna (`/api/*`) responde **401**.
- Solo entran **cuentas de administrador sembradas (seeded admins)**. Las cuentas no-admin son rechazadas aunque la contraseña sea correcta.
- Acceso por **contraseña** (la de `seed-admins`) o por **enlace mágico** enviado al email.
- **No existe pantalla de "olvidé mi contraseña".** Si no recuerdas la clave, usa el enlace mágico o pide a un admin que vuelva a sembrar tu cuenta.

### Datos de referencia que verás repetidos

- Proyectos con datos estructurados (dashboards y páginas de cifras): **solo MAD y BHX**.
- KLP, PHILAE y GVF: tienen documentos en el corpus (consultables por el chat) pero **no** tienen cifras en las páginas de dashboard.
- Corpus gobernado: ~**5.498 documentos** / ~**156.898 fragmentos (chunks)**.
- Decisiones abiertas esperadas: ~**6**. Existen riesgos, acciones y tareas reales cargados para MAD/BHX.
- **Aviso de moneda (BHX):** algunas páginas etiquetan importes de Birmingham como **GBP**, pero internamente las cifras pueden estar almacenadas en **EUR**. Trata los símbolos de moneda de BHX con cautela y anótalo si una cifra parece inconsistente.

---

## 2. Mapa de superficies a probar

| Sección (Sidebar) | Página | Ruta | Casos |
|---|---|---|---|
| (Auth) | Login | `/login` | CP-LOGIN-01..05 |
| **Tower Control** | CEO Dashboard | `/` | CP-DASH-01..03 |
| | Portfolio | `/portfolio` | CP-PORT-01..02 |
| | Critical Path | `/critical-path` | CP-CRIT-01..03 |
| | Funding & Cash | `/funding` | CP-FUND-01..03 |
| | Ops Readiness | `/ops-readiness` | CP-OPS-01..02 |
| | F&B Readiness | `/fnb-readiness` | CP-FNB-01..02 |
| | Pricing | `/pricing` | CP-PRIC-01..02 |
| | Commercial | `/commercial` | CP-COMM-01..02 |
| | BP & Budget | `/bp-budget` | CP-BP-01..02 |
| | Risks & Actions | `/risks` | CP-RISK-01..04 |
| | Decisions | `/decisions` | CP-DEC-01..02 |
| | (Detalle proyecto) | `/project/MAD`,`/project/BHX` | CP-PROJ-01 |
| **Knowledge System** | Document Bot (chat) | `/chat` | CP-CHAT-01..05 |
| | Document Ingestion | `/admin/ingest` | CP-ING-01..03 |
| | Evidence Review | `/admin/review` | CP-REV-01..05 |
| | Gestor Documental | `/admin/documents` | CP-DOC-01..07 |
| | Pack Grounding | `/admin/packs` | CP-PACK-01..03 |
| **Transversal** | Navegación / sesión | (todas) | CP-NAV-01..03 |

---

## 3. Escenario 0 — Camino crítico de negocio (end-to-end)

> Este escenario demuestra la propuesta de valor completa del MIS: *iniciar sesión → preguntar al bot y obtener respuesta con citas de fuentes → gobernar un documento → revisar un candidato de métrica → leer los dashboards*. **Ejecútalo primero.** Si este flujo funciona de principio a fin, el producto cumple su promesa base.

| ID | CP-E2E-00 |
|---|---|
| **Objetivo** | Validar el recorrido completo de un CEO/analista: del login a la decisión informada, pasando por la trazabilidad documental. |
| **Precondiciones** | Cuenta admin sembrada con credenciales conocidas. Navegador limpio (sin sesión previa). |

**Pasos:**

1. Abre la app en el navegador. Al no haber sesión, debes aterrizar en `/login` (formulario "Gemswell MIS").
2. Introduce el email y la contraseña de admin y pulsa **Entrar**.
3. Verifica que entras al **CEO Dashboard** (`/`) con la cabecera oscura "CEO Dashboard — Portfolio View" y dos tarjetas de proyecto (MAD y BHX).
4. En el menú izquierdo, sección **Knowledge System**, pulsa **Document Bot**.
5. Pulsa una de las preguntas sugeridas, p. ej. **"¿Cuál es el estado actual del CapEx de Madrid?"** (o escríbela y pulsa Enter).
6. Espera la respuesta. Mientras carga, verás puntos animados y un texto de progreso ("Buscando documentos…" → "Analizando cifras…" → "Verificando fuentes…").
7. Cuando llegue la respuesta, comprueba que **debajo del mensaje aparecen las fuentes desplegadas por defecto**, cada una con: nombre del documento, % relevante, etiqueta de proyecto, tipo de documento, nivel de verificación (source of record / supporting / context / unverified) y, si aplica, "authority N".
8. En el menú, pulsa **Gestor Documental** (`/admin/documents`). Verás la cabecera de salud del corpus y una tabla de documentos.
9. Haz clic en una fila de documento. Se abre a la derecha un panel con metadatos y botones de gobierno (**Aprobar / Rechazar / Reclasificar / Retirar / Superseder**).
10. Pulsa **Aprobar**. Aparece un aviso (toast) "Acción «approve» aplicada" y el panel se refresca con el nuevo estado.
11. En el menú, pulsa **Evidence Review** (`/admin/review`). Verás las cifras de resumen (Pending Review, Accepted, etc.) y tarjetas de candidatos.
12. En una tarjeta de candidato (estado *Pending Review*), pulsa **Accept**. Aparece toast "Accepted ✓" y la tarjeta desaparece de la lista; el contador "Accepted" sube.
13. Vuelve al **CEO Dashboard** (`/`) y a **Portfolio** (`/portfolio`); confirma que muestran cifras coherentes de MAD y BHX (CapEx, cash, decisiones, acciones).

| **Resultado esperado** | El recorrido completo se ejecuta sin errores ni pantallas en blanco. La respuesta del chat **incluye citas de fuentes visibles**. Las acciones de gobierno (aprobar documento, aceptar candidato) confirman con toast y actualizan la interfaz. Los dashboards muestran datos reales de MAD/BHX. |
| **Estado (OK/KO/N.A.)** |  |
| **Observaciones** |  |

---

## 4. Autenticación (`/login`)

### CP-LOGIN-01 — Acceso correcto con contraseña

| Campo | Detalle |
|---|---|
| **Objetivo** | Un admin sembrado entra con email + contraseña. |
| **Precondiciones** | Sin sesión activa. Credenciales admin válidas. |

**Pasos:**
1. Navega a `/login`.
2. Escribe el email admin en el campo "email".
3. Escribe la contraseña en "contraseña".
4. Pulsa **Entrar**.

| **Resultado esperado** | Redirige al CEO Dashboard (`/`) y el menú lateral queda visible. |
| **Estado** | |
| **Observaciones** | |

---

### CP-LOGIN-02 — Cuenta no-admin rechazada

| Campo | Detalle |
|---|---|
| **Objetivo** | Una cuenta sin permiso de administrador no puede entrar. |
| **Precondiciones** | Disponer de credenciales de una cuenta que NO sea admin (si existe). Si no se dispone, marcar N.A. |

**Pasos:**
1. Navega a `/login`.
2. Introduce email + contraseña de la cuenta no-admin.
3. Pulsa **Entrar**.

| **Resultado esperado** | Aparece el mensaje de error rojo "Tu cuenta no tiene acceso de administrador." y NO se entra a la app (la sesión se cierra automáticamente). |
| **Estado** | |
| **Observaciones** | |

---

### CP-LOGIN-03 — Credenciales incorrectas

| Campo | Detalle |
|---|---|
| **Objetivo** | Contraseña errónea muestra error claro y no entra. |
| **Precondiciones** | Email admin válido. |

**Pasos:**
1. Navega a `/login`.
2. Introduce el email admin y una contraseña incorrecta.
3. Pulsa **Entrar**.

| **Resultado esperado** | Aparece un toast de error con el mensaje del servidor (credenciales inválidas). Permaneces en `/login`. |
| **Estado** | |
| **Observaciones** | |

---

### CP-LOGIN-04 — Enlace mágico (magic link)

| Campo | Detalle |
|---|---|
| **Objetivo** | El acceso por enlace mágico funciona para un admin sembrado. |
| **Precondiciones** | Email admin con bandeja de entrada accesible. |

**Pasos:**
1. Navega a `/login`.
2. Escribe el email admin.
3. Pulsa **Enviar enlace mágico**.
4. Verifica el aviso "Te enviamos un enlace de acceso. Revisa tu email."
5. Abre el email recibido y pulsa el enlace.

| **Resultado esperado** | El enlace abre la app autenticada (CEO Dashboard u otra página). Si el enlace caducó/ya se usó, vuelve a `/login` con el mensaje "El enlace de acceso caducó o no es válido. Solicita uno nuevo." |
| **Estado** | |
| **Observaciones** | |

---

### CP-LOGIN-05 — Enlace mágico NO crea cuentas nuevas

| Campo | Detalle |
|---|---|
| **Objetivo** | Pedir enlace mágico con un email no registrado no crea acceso. |
| **Precondiciones** | Un email que NO corresponda a ningún admin sembrado. |

**Pasos:**
1. Navega a `/login`.
2. Escribe un email no registrado.
3. Pulsa **Enviar enlace mágico**.

| **Resultado esperado** | El sistema no concede acceso a una cuenta nueva. (Aunque la UI pueda mostrar el aviso genérico de envío, no debe llegar un enlace que dé acceso, o el enlace no autentica). Documentar el comportamiento observado. |
| **Estado** | |
| **Observaciones** | |

---

## 5. Tower Control

### CP-DASH-01 — Carga del CEO Dashboard

| Campo | Detalle |
|---|---|
| **Objetivo** | El dashboard carga y muestra el estado global de los dos proyectos. |
| **Precondiciones** | Sesión admin activa. |

**Pasos:**
1. Pulsa **CEO Dashboard** en el menú (o navega a `/`).
2. Observa la cabecera oscura y los bloques de la página.

| **Resultado esperado** | Cabecera "CEO Dashboard — Portfolio View" con semana/año, fecha de datos y "2 activos". Fila "Portfolio" con **dos tarjetas** (MAD y BHX) mostrando: días a apertura/NTP, CAPEX comprometido, EAC Variance, hitos críticos en rojo, cash neto 13W y barra de progreso CAPEX. Más abajo: tablas de camino crítico, barras CAPEX, "Decisiones abiertas" y "Acciones esta semana". Pie con frescura de datos por proyecto. |
| **Estado** | |
| **Observaciones** | |

---

### CP-DASH-02 — Decisiones y acciones reales en el dashboard

| Campo | Detalle |
|---|---|
| **Objetivo** | El bloque inferior muestra decisiones abiertas y acciones reales con responsable y fecha. |
| **Precondiciones** | Sesión admin. Datos de decisiones/acciones cargados (esperado: ~6 decisiones abiertas). |

**Pasos:**
1. En `/`, baja hasta "Decisiones abiertas & acciones de la semana".
2. Revisa la lista de **Decisiones abiertas** (con su badge contador) y la de **Acciones esta semana**.
3. Pulsa "ver todas →" en decisiones (lleva a `/decisions`) y vuelve. Repite con acciones (lleva a `/risks`).

| **Resultado esperado** | Cada decisión muestra código, tipo de reunión, proyecto, tema, responsable y fecha "due" (en rojo con ⚠ si está vencida). Las acciones muestran código, proyecto, título, responsable y fecha. Si no hubiera datos, se ve "Sin decisiones pendientes" / "Sin acciones pendientes esta semana" con icono. |
| **Estado** | |
| **Observaciones** | |

---

### CP-DASH-03 — Estado de error / sesión expirada (dashboard)

| Campo | Detalle |
|---|---|
| **Objetivo** | Si la sesión expira o falla la carga, el dashboard muestra recuperación, no pantalla en blanco. |
| **Precondiciones** | Sesión admin. Para forzar el caso: dejar la pestaña inactiva mucho tiempo o cerrar sesión en otra pestaña y luego pulsar "Reintentar". |

**Pasos:**
1. Provoca un fallo de carga (sesión caducada) y refresca `/`.
2. Observa el mensaje y los botones.

| **Resultado esperado** | Se muestra el recuadro "No se pudo cargar el dashboard" con "La sesión pudo expirar. Reintenta o vuelve a iniciar sesión." y botones **Reintentar** e **Iniciar sesión**. |
| **Estado** | |
| **Observaciones** | |

---

### CP-PORT-01 — Tabla comparativa de Portfolio

| Campo | Detalle |
|---|---|
| **Objetivo** | La página Portfolio compara MAD y BHX lado a lado. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Portfolio** (`/portfolio`).
2. Revisa la tabla con columnas por proyecto.

| **Resultado esperado** | Tabla "Portfolio Overview" con secciones **Project Status** (Stage, Opening Target, Currency), **Capital Expenditure** (Budget Baseline, Approved, Committed, Paid to Date, EAC, Execution %, EAC Variance) y **Cash Flow** (Inflows, Outflows, Net Cash Flow). Cada proyecto muestra su ciudad/país y un punto RAG de estado. Importes con formato compacto. |
| **Estado** | |
| **Observaciones** | |

---

### CP-PORT-02 — Aviso de moneda BHX

| Campo | Detalle |
|---|---|
| **Objetivo** | Verificar la etiqueta de moneda de BHX y dejar constancia de posibles inconsistencias. |
| **Precondiciones** | Página Portfolio cargada. |

**Pasos:**
1. En `/portfolio`, localiza la fila **Currency** y los importes de la columna BHX.
2. Comprueba qué símbolo de moneda muestra (GBP/£) frente a las magnitudes.

| **Resultado esperado** | BHX se etiqueta como GBP. **Nota conocida:** las cifras pueden estar almacenadas en EUR aunque se muestren con símbolo de libra; anota cualquier cifra que parezca incoherente para revisión posterior. (Caso informativo, no bloqueante). |
| **Estado** | |
| **Observaciones** | |

---

### CP-CRIT-01 — Camino crítico por proyecto (pestañas)

| Campo | Detalle |
|---|---|
| **Objetivo** | La página Critical Path permite alternar entre MAD y BHX y muestra programa, gates y bloqueos. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Critical Path** (`/critical-path`).
2. Observa el título y el conmutador de proyecto (MAD/BHX).
3. Cambia de pestaña entre MAD y BHX.

| **Resultado esperado** | Título "Critical Path", subtítulo "Programme schedule · gate status · open blockers". El conmutador cambia los datos mostrados. Hay secciones de **Gate Tracker** (gates L0 / opening gate), tareas y bloqueos. Las cifras de slack/forecast se actualizan al cambiar de proyecto. |
| **Estado** | |
| **Observaciones** | |

---

### CP-CRIT-02 — Estado vacío de gates

| Campo | Detalle |
|---|---|
| **Objetivo** | Si un proyecto no tiene gates L0, se muestra un mensaje claro, no un error. |
| **Precondiciones** | Critical Path cargada. |

**Pasos:**
1. En `/critical-path`, selecciona el proyecto que tenga menos datos de schedule (p. ej. BHX).
2. Observa la sección de gates.

| **Resultado esperado** | Si no hay gates, aparece el mensaje "No L0 gates found for this project" dentro de un estado vacío, sin romper el resto de la página. |
| **Estado** | |
| **Observaciones** | |

---

### CP-CRIT-03 — Error de carga (Critical Path)

| Campo | Detalle |
|---|---|
| **Objetivo** | Fallo de carga muestra recuperación. |
| **Precondiciones** | Forzar sesión caducada. |

**Pasos:**
1. Con sesión caducada, refresca `/critical-path`.

| **Resultado esperado** | Mensaje "No se pudo cargar la ruta crítica" con opción de reintentar / iniciar sesión. |
| **Estado** | |
| **Observaciones** | |

---

### CP-FUND-01 — Funding & Cash por proyecto

| Campo | Detalle |
|---|---|
| **Objetivo** | La página muestra instrumentos de financiación y flujo de caja por proyecto. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Funding & Cash** (`/funding`).
2. Revisa los KPIs superiores y la tabla de instrumentos.
3. Cambia entre MAD y BHX.

| **Resultado esperado** | Título "Funding & Cash". KPIs: total comprometido, dispuesto (drawn), y no dispuesto (undrawn) con formato compacto. Tabla de instrumentos con comprometido/dispuesto/no dispuesto por línea. Sección de cash con actual/forecast/net. Los datos cambian al alternar proyecto. |
| **Estado** | |
| **Observaciones** | |

---

### CP-FUND-02 — Estado sin datos de financiación

| Campo | Detalle |
|---|---|
| **Objetivo** | Si un proyecto no tiene instrumentos, se muestra mensaje, no error. |
| **Precondiciones** | Funding cargada. |

**Pasos:**
1. En `/funding`, selecciona el proyecto sin datos de financiación (si lo hay).

| **Resultado esperado** | Mensaje "Sin datos de financiación para este proyecto". El resto de la UI permanece estable. |
| **Estado** | |
| **Observaciones** | |

---

### CP-FUND-03 — Coherencia de moneda en Funding

| Campo | Detalle |
|---|---|
| **Objetivo** | Verificar la moneda mostrada (es de nivel proyecto, no por instrumento). |
| **Precondiciones** | Funding en BHX. |

**Pasos:**
1. En `/funding`, selecciona BHX.
2. Observa los símbolos de moneda de los instrumentos.

| **Resultado esperado** | Todos los instrumentos usan la **misma moneda de proyecto** (no hay moneda por instrumento). Anota si algún importe BHX en EUR/GBP resulta confuso. (Limitación conocida). |
| **Estado** | |
| **Observaciones** | |

---

### CP-OPS-01 — Ops Readiness por proyecto

| Campo | Detalle |
|---|---|
| **Objetivo** | La página de preparación operativa carga por proyecto. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Ops Readiness** (`/ops-readiness`).
2. Revisa las secciones y cambia entre MAD y BHX.

| **Resultado esperado** | Título "Ops Readiness". Conmutador MAD/BHX funcional. Se muestran indicadores/secciones de readiness operativa. Sin pantallas en blanco. |
| **Estado** | |
| **Observaciones** | |

---

### CP-OPS-02 — Error de carga (Ops Readiness)

| Campo | Detalle |
|---|---|
| **Objetivo** | Fallo de carga muestra recuperación. |
| **Precondiciones** | Forzar sesión caducada. |

**Pasos:**
1. Con sesión caducada, refresca `/ops-readiness`.

| **Resultado esperado** | Mensaje "No se pudo cargar — la sesión pudo expirar" con opción de reintentar / iniciar sesión. |
| **Estado** | |
| **Observaciones** | |

---

### CP-FNB-01 — F&B Readiness por proyecto

| Campo | Detalle |
|---|---|
| **Objetivo** | La página de preparación de F&B carga por proyecto. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **F&B Readiness** (`/fnb-readiness`).
2. Revisa las secciones y cambia entre MAD y BHX.

| **Resultado esperado** | Título "F&B Readiness". Conmutador MAD/BHX funcional. Secciones de readiness de F&B. Sin errores. |
| **Estado** | |
| **Observaciones** | |

---

### CP-FNB-02 — Estado vacío / error (F&B)

| Campo | Detalle |
|---|---|
| **Objetivo** | Datos ausentes o fallo de sesión no rompen la página. |
| **Precondiciones** | F&B cargada. |

**Pasos:**
1. Selecciona el proyecto con menos datos de F&B.
2. (Opcional) Fuerza sesión caducada y refresca.

| **Resultado esperado** | Estado vacío o mensaje de error con recuperación, según corresponda. La página no queda en blanco. |
| **Estado** | |
| **Observaciones** | |

---

### CP-PRIC-01 — Pricing & Ticketing

| Campo | Detalle |
|---|---|
| **Objetivo** | La página de precios muestra capacidad, ventas y ocupación por proyecto. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Pricing** (`/pricing`).
2. Revisa las KPI cards y cambia entre MAD y BHX.

| **Resultado esperado** | Título "Pricing & Ticketing". KPIs: "Total Capacity" (unidades), "Units Sold" con % de ocupación. Datos por proyecto al alternar pestaña. |
| **Estado** | |
| **Observaciones** | |

---

### CP-PRIC-02 — Error de carga (Pricing)

| Campo | Detalle |
|---|---|
| **Objetivo** | Fallo de carga muestra recuperación. |
| **Precondiciones** | Forzar sesión caducada. |

**Pasos:**
1. Con sesión caducada, refresca `/pricing`.

| **Resultado esperado** | Mensaje "No se pudo cargar" con opción de reintentar / iniciar sesión. |
| **Estado** | |
| **Observaciones** | |

---

### CP-COMM-01 — Commercial (reservas, ingresos, canales)

| Campo | Detalle |
|---|---|
| **Objetivo** | La página comercial muestra reservas, ingresos, depósitos y rendimiento por canal/semana. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Commercial** (`/commercial`).
2. Revisa las KPI cards y las tablas de canales y semanas.
3. Cambia entre MAD y BHX.

| **Resultado esperado** | Título "Commercial". KPIs: "Total Reservations", "Revenue Booked", "Total Deposits", gasto de marketing. Tabla por canal (leads, reservas, gasto) y tabla por semana (reservas, revenue, depósitos, gasto). Datos por proyecto. |
| **Estado** | |
| **Observaciones** | |

---

### CP-COMM-02 — Estado vacío / error (Commercial)

| Campo | Detalle |
|---|---|
| **Objetivo** | Datos ausentes o fallo de sesión no rompen la página. |
| **Precondiciones** | Commercial cargada. |

**Pasos:**
1. Selecciona el proyecto con menos datos comerciales.
2. (Opcional) Fuerza sesión caducada y refresca.

| **Resultado esperado** | Estado vacío o de error con recuperación. Sin pantalla en blanco. |
| **Estado** | |
| **Observaciones** | |

---

### CP-BP-01 — BP & Budget (monitorización CapEx)

| Campo | Detalle |
|---|---|
| **Objetivo** | La página de presupuesto muestra el detalle de CapEx por partida y totales. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **BP & Budget** (`/bp-budget`).
2. Revisa las KPI cards y la tabla de partidas.
3. Cambia entre MAD y BHX.

| **Resultado esperado** | Título "BP & Budget — CapEx Monitoring". KPIs de budget/committed/paid/EAC. Tabla con baseline, approved, committed, paid y EAC por línea, y una fila de totales. Datos por proyecto. |
| **Estado** | |
| **Observaciones** | |

---

### CP-BP-02 — Contradicción CapEx MAD (informativo)

| Campo | Detalle |
|---|---|
| **Objetivo** | Dejar constancia de la contradicción conocida de CapEx de Madrid (~€57M vs ~€65M) pendiente de CFO. |
| **Precondiciones** | BP & Budget en MAD. También se puede observar en `/admin/review` (panel de contradicciones). |

**Pasos:**
1. Revisa las cifras de CapEx de MAD en `/bp-budget`.
2. Ve a `/admin/review` y mira el panel "Open Contradictions".

| **Resultado esperado** | Existe una contradicción registrada de CapEx MAD (dos cifras divergentes) marcada como abierta. No es un fallo de la app: es un dato real pendiente de resolución del CFO. Anotar las cifras vistas. |
| **Estado** | |
| **Observaciones** | |

---

### CP-RISK-01 — Listado de riesgos y acciones por proyecto

| Campo | Detalle |
|---|---|
| **Objetivo** | La página muestra riesgos y acciones reales por proyecto. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Risks & Actions** (`/risks`).
2. Cambia entre "Madrid Playa Surf" y "Birmingham".
3. Revisa las listas de riesgos y acciones.

| **Resultado esperado** | Título "Risks & Actions". Conmutador con etiquetas "Madrid Playa Surf" / "Birmingham". Se listan riesgos y acciones reales. Datos por proyecto. |
| **Estado** | |
| **Observaciones** | |

---

### CP-RISK-02 — Crear un riesgo nuevo

| Campo | Detalle |
|---|---|
| **Objetivo** | El formulario de alta de riesgo crea un riesgo correctamente. |
| **Precondiciones** | Risks cargada en un proyecto. |

**Pasos:**
1. En `/risks`, pulsa el botón de **nuevo riesgo** (abre un diálogo).
2. Rellena "Risk title", descripción (opcional), probabilidad (1–5), días de impacto y plan de mitigación.
3. Pulsa el botón de guardar (no "Cancel").

| **Resultado esperado** | El riesgo se crea y aparece en la lista del proyecto. El diálogo se cierra. Botón deshabilitado mientras envía. |
| **Estado** | |
| **Observaciones** | |

---

### CP-RISK-03 — Crear una acción nueva

| Campo | Detalle |
|---|---|
| **Objetivo** | El formulario de alta de acción crea una acción correctamente. |
| **Precondiciones** | Risks cargada en un proyecto. |

**Pasos:**
1. En `/risks`, pulsa el botón de **nueva acción** (abre un diálogo).
2. Rellena "Action title" y los campos requeridos.
3. Pulsa guardar.

| **Resultado esperado** | La acción se crea y aparece en la lista. El diálogo se cierra. |
| **Estado** | |
| **Observaciones** | |

---

### CP-RISK-04 — Cancelar formulario sin crear

| Campo | Detalle |
|---|---|
| **Objetivo** | Pulsar "Cancel" en el diálogo no crea nada. |
| **Precondiciones** | Diálogo de riesgo o acción abierto con campos rellenos. |

**Pasos:**
1. Abre el diálogo de nuevo riesgo y escribe un título.
2. Pulsa **Cancel** (o la X de cerrar).

| **Resultado esperado** | El diálogo se cierra y NO se crea ningún riesgo nuevo en la lista. |
| **Estado** | |
| **Observaciones** | |

---

### CP-DEC-01 — Listado de decisiones

| Campo | Detalle |
|---|---|
| **Objetivo** | La página Decisiones muestra todas las decisiones con su estado. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Decisions** (`/decisions`).
2. Revisa la tabla.

| **Resultado esperado** | Título "Decisiones". Tabla con decisiones; estado "Abierta"/"Cerrada", proyecto, responsable y fecha de implementación. Las vencidas y abiertas se marcan (overdue). Esperado: alrededor de 6 abiertas. |
| **Estado** | |
| **Observaciones** | |

---

### CP-DEC-02 — Estado vacío / error (Decisiones)

| Campo | Detalle |
|---|---|
| **Objetivo** | Sin datos o fallo de sesión no rompen la página. |
| **Precondiciones** | Decisiones cargada. |

**Pasos:**
1. (Si no hay decisiones) observa el estado vacío.
2. (Opcional) Fuerza sesión caducada y refresca; pulsa "Reintentar".

| **Resultado esperado** | Estado vacío "Sin decisiones registradas" o recuadro de error con "Reintentar". |
| **Estado** | |
| **Observaciones** | |

---

### CP-PROJ-01 — Detalle de proyecto

| Campo | Detalle |
|---|---|
| **Objetivo** | El detalle de un proyecto (enlazado desde el dashboard) carga correctamente. |
| **Precondiciones** | Sesión admin. (No hay entrada propia en el menú; se accede vía "Ver proyecto →" del dashboard). |

**Pasos:**
1. En `/`, en una tarjeta de proyecto, pulsa **Ver proyecto →** (lleva a `/project/MAD` o `/project/BHX`).
2. Revisa la página de detalle.

| **Resultado esperado** | Se abre la ficha del proyecto seleccionado con su información. Repite para el otro proyecto. Sin error ni página en blanco. |
| **Estado** | |
| **Observaciones** | |

---

## 6. Knowledge System

### CP-CHAT-01 — Respuesta del bot con citas de fuentes (diferenciador)

| Campo | Detalle |
|---|---|
| **Objetivo** | El Document Bot responde una pregunta y muestra las fuentes citadas, desplegadas por defecto. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Document Bot** (`/chat`).
2. Pulsa una pregunta sugerida, p. ej. "¿Cuál es el estado actual del CapEx de Madrid?".
3. Espera la respuesta.
4. Revisa el bloque de fuentes bajo la respuesta.

| **Resultado esperado** | La respuesta llega como texto formateado. **Debajo aparecen las fuentes desplegadas por defecto** con: nombre del documento (enlazado si hay URL), % relevante, etiqueta de **proyecto**, **tipo de documento**, **nivel de verificación** (source of record / supporting / context / unverified) y "authority N" si existe. Botón "Ocultar fuentes (N)" / "Ver N fuentes" para plegar/desplegar. |
| **Estado** | |
| **Observaciones** | |

---

### CP-CHAT-02 — Consulta libre escrita por el usuario

| Campo | Detalle |
|---|---|
| **Objetivo** | El bot responde una pregunta escrita a mano. |
| **Precondiciones** | Chat abierto. |

**Pasos:**
1. En el campo de texto, escribe una pregunta propia (p. ej. "Compara el CapEx de MAD y BHX").
2. Pulsa Enter (o el botón de enviar).

| **Resultado esperado** | El mensaje aparece a la derecha; el bot responde con texto y, cuando aplique, fuentes. Mientras procesa, se ven los puntos animados con texto de progreso rotativo. |
| **Estado** | |
| **Observaciones** | |

---

### CP-CHAT-03 — Tiempos de respuesta y progreso (sin streaming)

| Campo | Detalle |
|---|---|
| **Objetivo** | Confirmar que una consulta compleja muestra progreso y no parece colgada. |
| **Precondiciones** | Chat abierto. |

**Pasos:**
1. Lanza una consulta que combine varias cifras (p. ej. "Resumen de flujo de caja de ambos proyectos").
2. Observa el indicador de carga.

| **Resultado esperado** | **Nota: el chat NO es en streaming.** Una respuesta multi-herramienta puede tardar **hasta ~2 minutos**. Durante ese tiempo se ve el indicador con texto "Buscando documentos… / Analizando cifras… / Verificando fuentes…". No es un fallo si tarda dentro de ese margen. |
| **Estado** | |
| **Observaciones** | |

---

### CP-CHAT-04 — Alcance por proyecto en el chat (limitación)

| Campo | Detalle |
|---|---|
| **Objetivo** | Verificar el comportamiento del filtrado por proyecto y dejar constancia de la limitación KLP/GVF/PHILAE. |
| **Precondiciones** | Chat abierto. |

**Pasos:**
1. Pregunta algo específico de MAD (p. ej. "estado del CapEx de Madrid").
2. Pregunta algo de Kelpa/fondo (p. ej. "¿Qué documentos hay sobre Kelpa HoldCo?").
3. Compara las fuentes mostradas.

| **Resultado esperado** | Para MAD/BHX el chat infiere el proyecto del texto de la pregunta y acota fuentes. Para **KLP/GVF/PHILAE** el filtrado por proyecto **no** está disponible en las herramientas del chat, aunque los documentos **siguen siendo localizables** de forma transversal (cross-project). El bot debe poder citar documentos de Kelpa/fondo aunque sin filtro de proyecto. (Limitación conocida). |
| **Estado** | |
| **Observaciones** | |

---

### CP-CHAT-05 — Timeout / nueva conversación

| Campo | Detalle |
|---|---|
| **Objetivo** | Verificar el mensaje de timeout y el reinicio de conversación. |
| **Precondiciones** | Chat con al menos un intercambio. |

**Pasos:**
1. (Si se produce) observa el mensaje cuando una consulta supera el límite (~120s).
2. Pulsa **Nueva conversación** (arriba a la derecha).

| **Resultado esperado** | Si una consulta excede el tiempo, aparece "La consulta tardó demasiado y se canceló. Inténtalo de nuevo o reformúlala.". "Nueva conversación" limpia el historial y vuelve a la pantalla inicial con preguntas sugeridas. |
| **Estado** | |
| **Observaciones** | |

---

### CP-ING-01 — Listado del manifiesto de ingesta

| Campo | Detalle |
|---|---|
| **Objetivo** | La pantalla de ingesta lista los archivos del DMS con sus filtros. |
| **Precondiciones** | Sesión admin. Manifiesto del DMS disponible. |

**Pasos:**
1. Pulsa **Document Ingestion** (`/admin/ingest`).
2. Observa la cabecera con el resumen (nº de archivos, alta relevancia, grupos de versiones).
3. Prueba los filtros (proyecto, categoría, relevancia, versión, búsqueda).

| **Resultado esperado** | Cabecera "Document Ingestion" con conteos. Tabla de archivos con Score, Proyecto, Categoría, Fichero, tamaño y estado. Filtros funcionan y reducen la lista. Por defecto **ningún archivo está seleccionado**. (Si no hay manifiesto, se muestra "No manifest found. Run the DMS scanner first."). |
| **Estado** | |
| **Observaciones** | |

---

### CP-ING-02 — Selección de archivos relevantes

| Campo | Detalle |
|---|---|
| **Objetivo** | Las herramientas de selección marcan archivos sin encolar nada todavía. |
| **Precondiciones** | Ingesta cargada con archivos. |

**Pasos:**
1. Pulsa **Auto-select high** (selecciona relevancia ≥75 no obsoletos).
2. Observa el contador "N selected (X MB)".
3. Prueba "Select filtered" y "Deselect filtered".

| **Resultado esperado** | La selección actualiza el contador y resalta filas. No se encola nada por seleccionar; solo se prepara la lista. |
| **Estado** | |
| **Observaciones** | |

---

### CP-ING-03 — Encolar archivos (solo queue, no procesa)

| Campo | Detalle |
|---|---|
| **Objetivo** | "Queue for Ingestion" encola, con confirmación; el procesamiento real es un paso de operador/CLI. |
| **Precondiciones** | Al menos un archivo seleccionado. |

**Pasos:**
1. Selecciona 1–2 archivos.
2. Pulsa **Queue N for Ingestion**.
3. Confirma el diálogo "¿Encolar N archivo(s) para ingesta?".

| **Resultado esperado** | Aparece un aviso "Queued N files for ingestion" y las filas pasan a estado "queued". **Limitación conocida:** la app solo ENCOLA; el procesamiento real lo ejecuta un operador con `ingest-worker` (no es un botón de la UI). **El OCR no está conectado.** |
| **Estado** | |
| **Observaciones** | |

---

### CP-REV-01 — Carga de Evidence Review

| Campo | Detalle |
|---|---|
| **Objetivo** | La pantalla de revisión muestra estadísticas y candidatos de métrica. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Evidence Review** (`/admin/review`).
2. Observa la barra de estadísticas y la lista de candidatos.

| **Resultado esperado** | Título "Evidence Review". Barra con contadores: Pending Review, Auto-Accepted, Accepted, Rejected, Failed, Contradictions. Candidatos agrupados por dominio (CapEx, Cash Flow, Funding…), cada tarjeta con valor, periodo, confianza, authority y fuente. |
| **Estado** | |
| **Observaciones** | |

---

### CP-REV-02 — Aceptar un candidato

| Campo | Detalle |
|---|---|
| **Objetivo** | Aceptar un candidato lo publica y lo retira de la lista pendiente. |
| **Precondiciones** | Existe ≥1 candidato en "Pending Review". |

**Pasos:**
1. Con el filtro "Pending Review", elige una tarjeta.
2. (Opcional) Despliega "Evidence quote" para ver la cita de evidencia.
3. Pulsa **Accept**.

| **Resultado esperado** | Toast "Accepted ✓". La tarjeta desaparece de la lista pendiente y el contador "Accepted" aumenta. |
| **Estado** | |
| **Observaciones** | |

---

### CP-REV-03 — Rechazar un candidato

| Campo | Detalle |
|---|---|
| **Objetivo** | Rechazar un candidato lo retira de la lista pendiente. |
| **Precondiciones** | Existe ≥1 candidato pendiente. |

**Pasos:**
1. En una tarjeta, pulsa **Reject**.

| **Resultado esperado** | Toast "Rejected". La tarjeta desaparece de la lista pendiente y sube el contador "Rejected". |
| **Estado** | |
| **Observaciones** | |

---

### CP-REV-04 — Override de valor

| Campo | Detalle |
|---|---|
| **Objetivo** | Corregir el valor de un candidato antes de aceptarlo. |
| **Precondiciones** | Candidato pendiente. |

**Pasos:**
1. En una tarjeta, pulsa **Override**.
2. Introduce un valor corregido y un motivo (opcional).
3. Pulsa **Confirm override**.

| **Resultado esperado** | Toast "Overridden ✓". El candidato se procesa con el valor corregido y se retira de la lista. |
| **Estado** | |
| **Observaciones** | |

---

### CP-REV-05 — Filtros, contradicciones y estado vacío

| Campo | Detalle |
|---|---|
| **Objetivo** | Validar filtros (estado/proyecto/dominio), panel de contradicciones y mensaje cuando no hay candidatos. |
| **Precondiciones** | Evidence Review cargada. |

**Pasos:**
1. Cambia el filtro de estado a "Accepted", luego "All". Filtra por proyecto (MAD/BHX) y dominio.
2. Si hay contradicciones, revisa el panel "Open Contradictions".
3. Selecciona un filtro sin resultados.

| **Resultado esperado** | Los filtros ajustan la lista y los contadores. El panel de contradicciones muestra métrica, proyecto, periodo, valores A vs B y Δ%. Sin resultados muestra "No pending candidates — run the extraction engine…" (o "No candidates match the current filter"). |
| **Estado** | |
| **Observaciones** | |

---

### CP-DOC-01 — Gestor Documental: listado y salud del corpus

| Campo | Detalle |
|---|---|
| **Objetivo** | La pantalla muestra la salud del corpus y el listado paginado de documentos. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Gestor Documental** (`/admin/documents`).
2. Observa el bloque de salud del corpus arriba.
3. Revisa la tabla y el total de documentos en el pie.

| **Resultado esperado** | Título "Gestor Documental". Bloque de salud del corpus visible. Tabla con columnas Título, Proj, Tipo, Auth, Estado, Trust, Chk. Paginación con "N documentos" y botones Anterior/Siguiente (50 por página). Total acorde al corpus (~5.498). |
| **Estado** | |
| **Observaciones** | |

---

### CP-DOC-02 — Filtros y búsqueda de documentos

| Campo | Detalle |
|---|---|
| **Objetivo** | Los filtros de estado, tipo, proyecto, authority y búsqueda funcionan. |
| **Precondiciones** | Listado cargado. |

**Pasos:**
1. Filtra por **Proyecto = MAD** y observa el listado.
2. Filtra por **Tipo** (p. ej. funding) y por **Estado** (needs_review).
3. Escribe en "Buscar título…" y pulsa Enter.
4. Marca "incluir retirados" y "sin markdown".

| **Resultado esperado** | Cada filtro reduce la lista coherentemente y reinicia a la página 1. La búsqueda por título devuelve coincidencias. Los checkboxes amplían/acotan el conjunto. |
| **Estado** | |
| **Observaciones** | |

---

### CP-DOC-03 — Panel de detalle del documento

| Campo | Detalle |
|---|---|
| **Objetivo** | Al seleccionar un documento se abre el panel con metadatos, markdown, chunks e historial. |
| **Precondiciones** | Listado cargado. |

**Pasos:**
1. Haz clic en una fila de documento.
2. En el panel derecho, revisa metadatos (proyecto, tipo, periodo, origen, clasificación, source_hash, versión) y badges.
3. Despliega "Markdown (reconstruido)", "Chunks (N)" e "Historial (N)".

| **Resultado esperado** | Panel lateral con título, badges de revisión/authority/verificación, ficha de metadatos y secciones colapsables. El historial lista las acciones previas con actor y fecha. |
| **Estado** | |
| **Observaciones** | |

---

### CP-DOC-04 — Aprobar un documento

| Campo | Detalle |
|---|---|
| **Objetivo** | Aprobar un documento actualiza su estado de revisión. |
| **Precondiciones** | Panel de documento abierto. |

**Pasos:**
1. En el panel, pulsa **Aprobar**.

| **Resultado esperado** | Toast "Acción «approve» aplicada". El panel se refresca con el badge de revisión actualizado y el listado se recarga. |
| **Estado** | |
| **Observaciones** | |

---

### CP-DOC-05 — Rechazar con motivo obligatorio

| Campo | Detalle |
|---|---|
| **Objetivo** | Rechazar exige un motivo; "Cancelar" no rechaza. |
| **Precondiciones** | Panel de documento abierto. |

**Pasos:**
1. Pulsa **Rechazar**. Se abre un formulario en línea.
2. Sin escribir motivo, comprueba que "Confirmar rechazo" está deshabilitado.
3. Pulsa **Cancelar**: no debe rechazar.
4. Vuelve a abrir, escribe un motivo y pulsa **Confirmar rechazo**.

| **Resultado esperado** | Sin motivo, no se puede confirmar. "Cancelar" cierra sin cambios. Con motivo, toast "Acción «reject» aplicada" y el estado pasa a rechazado. |
| **Estado** | |
| **Observaciones** | |

---

### CP-DOC-06 — Reclasificar documento

| Campo | Detalle |
|---|---|
| **Objetivo** | Cambiar tipo, tier de authority y/o proyecto de un documento. |
| **Precondiciones** | Panel de documento abierto. |

**Pasos:**
1. Pulsa **Reclasificar**. Se abre el formulario en línea.
2. Elige un `doc_type`, un `authority_tier` (verás el `authority_score` resultante) y/o escribe un `project_id` (MAD/BHX…).
3. Pulsa **Aplicar reclasificación**.

| **Resultado esperado** | Toast "Acción «reclassify» aplicada". Los metadatos del panel reflejan los nuevos valores. Si no se cambia nada, aparece "Nada que reclasificar". |
| **Estado** | |
| **Observaciones** | |

---

### CP-DOC-07 — Retirar / restaurar y superseder

| Campo | Detalle |
|---|---|
| **Objetivo** | Retirar un documento, restaurarlo y validar la regla de superseder. |
| **Precondiciones** | Panel de documento abierto. |

**Pasos:**
1. Pulsa **Retirar**. Confirma el cambio de estado (badge "Retirado").
2. Pulsa **Restaurar** para revertir.
3. En un documento retirado o rechazado, comprueba que el botón **Superseder…** está deshabilitado (tooltip explicativo).
4. En un documento válido, abre **Superseder…**, elige el documento al que reemplaza y confirma.

| **Resultado esperado** | Retirar/Restaurar muestran toast y actualizan el badge. Superseder está bloqueado para documentos retirados/rechazados; en uno válido, registra la sustitución (toast "Acción «supersede» aplicada"). |
| **Estado** | |
| **Observaciones** | |

---

### CP-PACK-01 — Listado de Packs de Reporting

| Campo | Detalle |
|---|---|
| **Objetivo** | La pantalla Pack Grounding lista los packs con su estado y completitud. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Pulsa **Pack Grounding** (`/admin/packs`).
2. Revisa la lista de packs.

| **Resultado esperado** | Título "Packs de Reporting". Cada pack muestra proyecto, área, badge "Crítico" si aplica, fecha "Due" (y enviado), barra de completitud con %, y estado (in_progress / submitted / published). Los vencidos no publicados se marcan con icono de alerta. |
| **Estado** | |
| **Observaciones** | |

---

### CP-PACK-02 — Detalle de un pack

| Campo | Detalle |
|---|---|
| **Objetivo** | Abrir el detalle de un pack desde el listado. |
| **Precondiciones** | Listado de packs con ≥1 entrada. |

**Pasos:**
1. Haz clic en un pack de la lista (lleva a `/admin/packs/{id}`).
2. Revisa el contenido del detalle.

| **Resultado esperado** | Se abre la ficha del pack seleccionado con su información de métricas/fuentes/evidencia. Sin error ni página en blanco. |
| **Estado** | |
| **Observaciones** | |

---

### CP-PACK-03 — Estado vacío / error (Packs)

| Campo | Detalle |
|---|---|
| **Objetivo** | Sin packs o fallo de sesión no rompen la página. |
| **Precondiciones** | Pack Grounding cargada. |

**Pasos:**
1. (Si no hay packs) observa el estado vacío.
2. (Opcional) Fuerza sesión caducada y refresca; pulsa "Reintentar".

| **Resultado esperado** | Estado vacío "No hay packs registrados" o recuadro de error "No se pudieron cargar los packs (la sesión pudo expirar)." con "Reintentar" / "Iniciar sesión". |
| **Estado** | |
| **Observaciones** | |

---

## 7. Transversal — Navegación y sesión

### CP-NAV-01 — Menú lateral y secciones

| Campo | Detalle |
|---|---|
| **Objetivo** | El menú muestra las dos secciones con todas sus entradas y resalta la página activa. |
| **Precondiciones** | Sesión admin. |

**Pasos:**
1. Revisa el menú: sección **Tower Control** (CEO Dashboard, Portfolio, Critical Path, Funding & Cash, Ops Readiness, F&B Readiness, Pricing, Commercial, BP & Budget, Risks & Actions, Decisions) y **Knowledge System** (Document Bot, Document Ingestion, Evidence Review, Gestor Documental, Pack Grounding).
2. Navega por varias entradas y comprueba el resaltado de la activa.
3. Pulsa el botón de colapsar/expandir (flecha) en la cabecera del menú.

| **Resultado esperado** | Todas las entradas presentes y navegables. La página actual queda resaltada. El menú se colapsa a iconos y se expande de nuevo. |
| **Estado** | |
| **Observaciones** | |

---

### CP-NAV-02 — Acceso sin sesión redirige a login

| Campo | Detalle |
|---|---|
| **Objetivo** | Cualquier ruta protegida sin sesión lleva a `/login`. |
| **Precondiciones** | Sin sesión (o tras "Cerrar sesión"). |

**Pasos:**
1. Cierra sesión (botón **Cerrar sesión** al pie del menú) o abre una ventana de incógnito.
2. Intenta acceder directamente a `/`, `/chat`, `/admin/documents`.

| **Resultado esperado** | Cada intento redirige a `/login`. Tras autenticarte, vuelves al destino solicitado. El menú no se muestra en `/login` ni en rutas `/auth`. |
| **Estado** | |
| **Observaciones** | |

---

### CP-NAV-03 — Cerrar sesión

| Campo | Detalle |
|---|---|
| **Objetivo** | Cerrar sesión termina la sesión y bloquea el acceso. |
| **Precondiciones** | Sesión admin activa. |

**Pasos:**
1. Pulsa **Cerrar sesión** al pie del menú lateral.
2. Intenta navegar a `/` directamente.

| **Resultado esperado** | La sesión se cierra y el acceso posterior redirige a `/login`. |
| **Estado** | |
| **Observaciones** | |

---

## 8. Resumen de ejecución

| Métrica | Valor |
|---|---|
| Total de casos | 45 (1 escenario E2E + 44 casos por superficie) |
| Casos OK | |
| Casos KO | |
| Casos N.A. | |
| Bloqueantes detectados | |
| Fecha de ejecución | |
| Probador(es) | |
| Versión / build probada | |

### Limitaciones conocidas a tener presentes (no marcar como KO)

- Chat **sin streaming**; respuestas multi-herramienta hasta **~2 min** (timeout 120s).
- Filtrado por proyecto en chat solo para **MAD/BHX**; KLP/GVF/PHILAE no son filtrables por proyecto (sí localizables).
- Moneda **BHX**: etiquetada GBP pero posiblemente almacenada en EUR; financiación/pricing/commercial usan moneda **de proyecto**, no por instrumento.
- Ingesta **solo encola**; el procesamiento real es paso de operador (`ingest-worker`). **OCR no conectado.**
- **Sin pantalla de recuperación de contraseña**: usar enlace mágico o reseed por admin.
- Dashboards y páginas de cifras cubren **solo MAD + BHX**.
- Contradicción CapEx MAD (~€57M vs ~€65M) **abierta** a propósito, pendiente de CFO.
