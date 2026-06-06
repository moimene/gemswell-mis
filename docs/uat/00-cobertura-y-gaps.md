# Cobertura y gaps — Revisión de los entregables UAT

**Rol:** Crítico de completitud (revisión cruzada de los cuatro entregables UAT contra el código real de la aplicación).
**Fecha:** 2026-06-06
**Documentos revisados:**
- `01-plan-de-pruebas-uat.md` (45 casos)
- `02-guia-tester.md`
- `03-plantilla-incidencias.md`
- `04-limitaciones-conocidas.md`

**Veredicto general:** Los cuatro entregables son **sólidos, precisos y listos para usar**. El plan de pruebas cubre el camino crítico de negocio completo y **todas** las superficies del Sidebar. Los textos esperados coinciden con el código real (login, chat, fuentes, gestor documental, ingesta, review). Las limitaciones conocidas listan **todos** los elementos diferidos del encargo. A continuación se documenta la cobertura verificada y una lista de **gaps menores** (ninguno bloqueante) recomendados para subsanar antes de arrancar la UAT.

---

## 1. Cobertura del camino crítico de negocio

El camino crítico definido en el encargo (login → preguntar al bot y obtener respuesta con citas → gobernar un documento → revisar un candidato de métrica → leer dashboards) está cubierto **de extremo a extremo** y **dos veces**:

- **Escenario E2E (CP-E2E-00)** en el plan: ejecuta el flujo completo en 13 pasos, con resultado esperado que exige explícitamente "la respuesta incluye citas de fuentes visibles". ✅
- **Quick-start de 5 minutos** (sección 7 de la guía del tester): replica el mismo flujo en lenguaje no técnico. ✅

Cada eslabón del camino tiene además casos dedicados:

| Eslabón del camino | Casos que lo cubren | Verificado en código |
|---|---|---|
| Login admin (password + magic-link) | CP-LOGIN-01..05 | `src/app/login/page.tsx` — textos exactos coinciden |
| Chat con citas (diferenciador) | CP-CHAT-01..05 | `src/app/chat/page.tsx` — fuentes desplegadas por defecto, project/doc_type/verificación/authority |
| Gobierno documental | CP-DOC-01..07 | `src/app/admin/documents/*` |
| Revisión de candidato | CP-REV-01..05 | `src/app/admin/review/page.tsx` |
| Dashboards | CP-DASH-01..03, CP-PORT, CP-FUND, etc. | `src/app/page.tsx` y páginas de dominio |

**Conclusión:** el camino crítico no tiene huecos.

---

## 2. Cobertura de superficies del Sidebar

Verificado contra `src/components/layout/Sidebar.tsx`. **Todas** las entradas reales del menú tienen al menos un caso de prueba. No falta ninguna superficie.

| Sección | Entrada (label real) | Ruta | Casos | Cubierta |
|---|---|---|---|:---:|
| Tower Control | CEO Dashboard | `/` | CP-DASH-01..03 | ✅ |
| Tower Control | Portfolio | `/portfolio` | CP-PORT-01..02 | ✅ |
| Tower Control | Critical Path | `/critical-path` | CP-CRIT-01..03 | ✅ |
| Tower Control | Funding & Cash | `/funding` | CP-FUND-01..03 | ✅ |
| Tower Control | Ops Readiness | `/ops-readiness` | CP-OPS-01..02 | ✅ |
| Tower Control | F&B Readiness | `/fnb-readiness` | CP-FNB-01..02 | ✅ |
| Tower Control | Pricing | `/pricing` | CP-PRIC-01..02 | ✅ |
| Tower Control | Commercial | `/commercial` | CP-COMM-01..02 | ✅ |
| Tower Control | BP & Budget | `/bp-budget` | CP-BP-01..02 | ✅ |
| Tower Control | Risks & Actions | `/risks` | CP-RISK-01..04 | ✅ |
| Tower Control | Decisions | `/decisions` | CP-DEC-01..02 | ✅ |
| Knowledge System | Document Bot | `/chat` | CP-CHAT-01..05 | ✅ |
| Knowledge System | Document Ingestion | `/admin/ingest` | CP-ING-01..03 | ✅ |
| Knowledge System | Evidence Review | `/admin/review` | CP-REV-01..05 | ✅ |
| Knowledge System | Gestor Documental | `/admin/documents` | CP-DOC-01..07 | ✅ |
| Knowledge System | Pack Grounding | `/admin/packs` | CP-PACK-01..03 | ✅ |
| (no en menú) | Detalle de proyecto | `/project/{id}` | CP-PROJ-01 | ✅ |
| Transversal | Navegación/sesión/logout | (todas) | CP-NAV-01..03 | ✅ |

**Observación positiva:** el plan incluye correctamente `/project/{id}` (CP-PROJ-01) aunque no está en el menú; se accede vía "Ver proyecto →" del dashboard. Buena cobertura de una ruta no obvia.

---

## 3. Precisión de los resultados esperados (verificado contra código)

Contrastado con el código fuente. Coincidencias confirmadas:

- **Login:** mensajes "Tu cuenta no tiene acceso de administrador.", "El enlace de acceso caducó o no es válido. Solicita uno nuevo.", "Te enviamos un enlace de acceso. Revisa tu email.", botones **Entrar** / **Enviar enlace mágico**. `shouldCreateUser: false` confirma que el magic-link NO crea cuentas (CP-LOGIN-05 correcto). ✅
- **Chat:** `LOADING_STAGES = ['Buscando documentos…', 'Analizando cifras…', 'Verificando fuentes…']`, timeout `120_000` ms, mensaje "La consulta tardó demasiado y se canceló…", botón "Nueva conversación", toggle "Ocultar fuentes (N)" / "Ver N fuentes". Fuentes renderizan: `relevance %`, `project_id`, `doc_type`, etiqueta de verificación (`source of record` / `supporting` / `context` / `unverified`) y `authority N`. **Todo coincide con CP-CHAT-01..05 y la guía.** ✅
- **Ingesta:** por defecto nada seleccionado, "Auto-select high" (relevancia ≥75 no obsoletos), "Select filtered"/"Deselect filtered", "Queue N for Ingestion", "Queued N files for ingestion", "No manifest found. Run the DMS scanner first.". ✅
- **Sesión:** logout vía `<form action="/auth/signout">`, Sidebar oculto en `/login` y `/auth/*`. CP-NAV correcto. ✅
- **Detalle de proyecto:** confirma la limitación de divisa — el código fija `ccy = projectId === 'BHX' ? 'GBP' : 'EUR'` literalmente, lo que valida el aviso de "BHX etiquetado GBP pero dato en EUR". ✅

---

## 4. Cobertura de las limitaciones conocidas (cross-check con el encargo)

Cada limitación/diferido del encargo aparece en `04-limitaciones-conocidas.md`. **Cobertura completa:**

| Limitación del encargo | Recogida en el doc 04 | Recogida en el plan |
|---|:---:|:---:|
| Chat sin streaming; hasta ~2 min; timeout 120s | §1 ✅ | CP-CHAT-03/05 ✅ |
| Scoping de chat solo MAD/BHX; KLP/GVF/PHILAE no filtrables (sí buscables) | §2 ✅ | CP-CHAT-04 ✅ |
| BHX en EUR pero etiquetado GBP | §3 ✅ | CP-PORT-02, CP-FUND-03 ✅ |
| Divisa por proyecto, no por instrumento | §4 ✅ | CP-FUND-03 ✅ |
| `/admin/ingest` solo encola; procesado = operador/CLI | §5 ✅ | CP-ING-03 ✅ |
| OCR no conectado | §5 ✅ | CP-ING-03 ✅ |
| Sin pantalla de reset de contraseña | §6 ✅ | sección "Datos de acceso" ✅ |
| Dashboards/facts solo MAD+BHX | §8 (con tabla por proyecto) ✅ | sección 1 + nota guía ✅ |

**Extra positivo:** el doc 04 añade dos puntos no exigidos pero correctos — §7 (solo admins / todo requiere login / 401 a mitad de uso) y la tabla de "qué proyecto para qué". El plan también documenta la contradicción de CapEx MAD (~€57M vs ~€65M) como abierta a propósito (CP-BP-02), buena decisión para que no se reporte como bug.

---

## 5. GAPS detectados (menores, no bloqueantes)

Ninguno invalida la UAT. Recomendados para pulir antes de empezar.

### GAP-1 — Referencia cruzada con número de documento equivocado
Tanto `03-plantilla-incidencias.md` (sección 2 y checklist) como el espíritu de los demás docs remiten a **`05-limitaciones-conocidas.md`**, pero el fichero real es **`04-limitaciones-conocidas.md`**. El tester que siga la referencia no encontrará el archivo.
**Acción:** corregir `05-` → `04-` en el doc 03 (dos apariciones: rúbrica de severidad y checklist final).
**Severidad:** Media (rompe una instrucción explícita al tester).

### GAP-2 — Copy de los estados de error es heterogéneo (y en parte en inglés)
El plan describe los estados de error con copy en español tipo "No se pudo cargar — la sesión pudo expirar" (CP-COMM-02, CP-FNB-02, CP-OPS-02, etc.). En el código real, varias páginas muestran ese texto en **inglés** y con redacción distinta:
- `commercial`: "Unable to load commercial data"
- `risks`: "Could not load risks — your session may have expired."
- `fnb-readiness`: recuadro ámbar con `AlertTriangle` (sin el texto exacto del plan).

Las páginas **sí** tienen recuperación (todas manejan `loadError`), así que no es un fallo de cobertura; pero un tester estricto podría marcar KO por "el texto no coincide".
**Acción:** en los casos de error (CP-COMM-02, CP-FNB-02, CP-RISK, CP-OPS-02, CP-PRIC-02) añadir la nota "el texto puede aparecer en inglés y variar entre páginas; lo importante es que haya recuperación, no la redacción exacta". Alternativamente, registrar como mejora de producto la unificación del copy de error (ES + consistencia).
**Severidad:** Baja.

### GAP-3 — La cita del diálogo de encolado está incompleta
CP-ING-03 cita el diálogo como *"¿Encolar N archivo(s) para ingesta?"*. El texto real es *"¿Encolar N archivo(s) para ingesta? **Esto crea trabajos de procesamiento reales.**"*. La segunda frase es relevante porque refuerza ante el tester que la acción no es inocua.
**Acción:** completar la cita en CP-ING-03.
**Severidad:** Baja.

### GAP-4 — Existe `/api/ingest/process`, conviene blindar la redacción de la limitación
El código tiene una ruta real `POST /api/ingest/process` (`processIngestQueueBatch`). La UI de `/admin/ingest` **no** expone ningún botón que la invoque (verificado: no hay referencia a `ingest/process` ni "Procesar" en la página), por lo que la limitación "la app solo ENCOLA; el procesado lo hace un operador/CLI" es **correcta desde la perspectiva del tester**. El gap es solo de cobertura de prueba: no hay caso que verifique explícitamente que **no aparece** un botón de "procesar ahora" en la UI.
**Acción (opcional):** añadir a CP-ING-03 una comprobación negativa: "Confirma que en la pantalla NO hay ningún botón de 'Procesar ahora'; el único disparador es Queue."
**Severidad:** Baja (informativa).

### GAP-5 — Modo de prueba de los estados de error de sesión poco operable
Varios casos (CP-DASH-03, CP-CRIT-03, CP-OPS-02, CP-PRIC-02, CP-FNB-02, CP-COMM-02, CP-DEC-02, CP-PACK-03) piden "forzar sesión caducada" como precondición, pero no explican **cómo** hacerlo de forma fiable para un tester no técnico (cerrar sesión en otra pestaña, borrar cookies, o esperar expiración no es trivial ni rápido).
**Acción:** añadir en la guía del tester (o en el preámbulo del plan) una receta corta y repetible para forzar el 401, p. ej.: "Abre una segunda pestaña, pulsa Cerrar sesión allí, vuelve a la primera pestaña y refresca". Marcar estos casos como **opcionales/best-effort** si no se logra reproducir.
**Severidad:** Baja (afecta a la ejecutabilidad de ~8 casos de borde, no al camino crítico).

### GAP-6 — No hay caso para `error.tsx` / `global-error.tsx` (frontera de error global)
Existen `src/app/error.tsx` y `src/app/global-error.tsx` (boundary de error de React) que se mostrarían ante un fallo de render no capturado. Ningún caso los menciona. Es un modo de fallo poco probable en UAT, pero si aparece, el tester no sabrá si es esperado.
**Acción (opcional):** una línea en la plantilla de incidencias o en la guía: "si ves una pantalla genérica de error de la aplicación (no un dashboard concreto), repórtala como Alto con captura".
**Severidad:** Baja (informativa).

---

## 6. Lo que NO es un gap (revisado y descartado)

- **Cobertura de KLP/GVF/PHILAE:** correctamente tratada como "solo documentos en el chat, sin facts en dashboards". No falta un caso de dashboard para ellos porque **no deben tener** dashboard (sería un falso positivo). ✅
- **Citas/fuentes del chat como diferenciador:** doblemente cubierto (CP-CHAT-01 + E2E) y con severidad "Alto" en la rúbrica si faltan. ✅
- **Acciones de gobierno con efectos destructivos** (retirar/superseder): cubiertas con sus reglas (superseder bloqueado en retirados/rechazados, rechazo con motivo obligatorio). ✅
- **Resumen de ejecución y rúbrica de severidad:** presentes y con ejemplos específicos de esta app. ✅

---

## 7. Recomendación final

**Apto para UAT** con una corrección recomendada antes de arrancar:

- **Imprescindible:** GAP-1 (referencia `05-` → `04-`), porque es una instrucción que el tester seguirá literalmente.
- **Recomendado:** GAP-2 y GAP-5 (notas sobre copy de error en inglés y receta para forzar sesión caducada), para evitar falsos KO en los ~10 casos de borde de error.
- **Opcional/pulido:** GAP-3, GAP-4, GAP-6.

El camino crítico de negocio, todas las superficies del Sidebar y todas las limitaciones diferidas están cubiertos. Los gaps son de pulido y ejecutabilidad, no de cobertura funcional.
