# Guía del Tester — Gemswell MIS (UAT)

> Bienvenida/o a las pruebas de aceptación (UAT) de **Gemswell MIS**. Esta guía está pensada para que cualquier miembro del equipo o stakeholder, sin conocimientos técnicos, pueda entrar, moverse por la aplicación y probar lo esencial. Léela una vez de principio a fin (10 minutos) antes de empezar.

---

## 1. ¿Qué es Gemswell MIS?

Gemswell MIS es el **sistema de información de gestión (MIS)** del portfolio de wave-parks de Gemswell Ventures. Reúne en un solo sitio toda la información financiera y documental de los proyectos —**Madrid Playa Surf (MAD)** y **Birmingham (BHX)**— y la pone a tu disposición de dos maneras: un **asistente conversacional** al que le preguntas en lenguaje natural y te responde **citando los documentos de los que ha sacado cada dato**, y una serie de **paneles ejecutivos** (CapEx, tesorería, financiación, riesgos, decisiones…) que muestran las cifras clave del portfolio. Por debajo hay un corpus gobernado de miles de documentos del que todo bebe.

---

## 2. Las 4 capas, en lenguaje sencillo

Gemswell MIS está construido en cuatro capas. No necesitas memorizarlas, pero te ayudará a entender qué estás probando en cada momento:

1. **El archivo (corpus gobernado).** Una gran biblioteca de **5.498 documentos** (troceados en 156.898 fragmentos) ya cargados y clasificados: actas de consejo, contratos, modelos financieros, informes, etc. Es la "fuente de la verdad" sobre la que se apoya todo lo demás.

2. **El asistente (chat con citas).** El **Document Bot** busca en ese archivo, selecciona los fragmentos más relevantes y redacta una respuesta **mostrando siempre las fuentes**: de qué proyecto es cada documento, su tipo, su nivel de verificación y su autoridad. Esta capa es **lo más diferenciador del producto**: no es un chatbot que "se inventa", sino uno que te enseña de dónde viene cada afirmación.

3. **La extracción (métricas y packs).** El sistema lee los documentos y propone automáticamente **cifras candidatas** (por ejemplo, un importe de CapEx que aparece en un informe). Una persona las **revisa y acepta o rechaza** antes de que pasen a los paneles. También permite agrupar cifras en *packs* de reporting.

4. **Los paneles (reporting).** El **CEO Dashboard** y las páginas de dominio (Portfolio, CapEx, Financiación, Tesorería, Riesgos, Decisiones…) presentan las cifras ya validadas de forma visual y ejecutiva.

> En resumen: **documentos → asistente con citas → cifras revisadas → paneles.**

---

## 3. Cómo entrar

La aplicación es **solo para administradores**. Todas las páginas requieren iniciar sesión; si no has entrado, te redirige a `/login`.

### Opción A — Email y contraseña (la habitual)
1. Abre la aplicación. Te llevará a la pantalla **/login** (cuadro blanco con el título "Gemswell MIS").
2. Escribe tu **email** y tu **contraseña** (la que se te facilitó con tu cuenta administradora "sembrada").
3. Pulsa **Entrar**. Entrarás directamente al CEO Dashboard.

### Opción B — Enlace mágico (magic-link)
1. En la misma pantalla, escribe tu **email** (la contraseña puedes dejarla vacía).
2. Pulsa **Enviar enlace mágico**. Verás el mensaje *"Te enviamos un enlace de acceso. Revisa tu email."*
3. Abre el correo y pulsa el enlace; te dejará dentro de la aplicación.
4. Si el enlace caduca, simplemente pide otro repitiendo el paso 2. (El enlace **no crea cuentas nuevas**: solo funciona para administradores ya dados de alta.)

### Si te deniega el acceso
- **"Tu cuenta no tiene acceso de administrador."** → Tu email no está habilitado como administrador. Avisa al responsable del UAT para que te dé de alta o use otra cuenta.
- **"El enlace de acceso caducó o no es válido."** → Pide un enlace mágico nuevo, o entra con contraseña.
- **No recuerdas la contraseña** → **Todavía no hay pantalla de "recuperar contraseña".** Usa el **enlace mágico** (Opción B) o pide a un administrador que te reasigne la cuenta.
- **Te saca a /login en mitad de la navegación** → Tu sesión expiró. Vuelve a entrar; te devolverá donde estabas.

### Cómo forzar una sesión caducada para pruebas opcionales
Algunos casos del plan piden probar qué pasa si la sesión expira. La forma más simple y repetible es:
1. Abre la app en dos pestañas del mismo navegador.
2. En la segunda pestaña pulsa **Cerrar sesión**.
3. Vuelve a la primera pestaña y refresca o pulsa **Reintentar** en la pantalla que estés probando.
4. Esperado: la app te devuelve a `/login` o muestra un aviso de sesión expirada recuperable.

Si no consigues reproducirlo, marca ese caso como *best-effort*; no bloquea el camino crítico.

---

## 4. Visita guiada: para qué sirve cada sección

A la izquierda tienes la barra de navegación con dos bloques. (Puedes plegarla con la flecha de la cabecera para ganar espacio.)

### Bloque "Tower Control" — los paneles ejecutivos
| Página | Para qué sirve |
|---|---|
| **CEO Dashboard** (inicio) | Vista de mando: estado global de MAD y BHX —CapEx comprometido, desviación del EAC, hitos críticos en rojo, caja neta a 13 semanas, decisiones pendientes—. Es tu punto de partida. |
| **Portfolio** | Estado comparado de los dos proyectos en una sola vista. |
| **Critical Path** | Hitos y ruta crítica de los proyectos (qué está en plazo y qué en rojo). |
| **Funding & Cash** | Instrumentos de financiación y posición de tesorería (disponible vs. dispuesto). |
| **Ops Readiness** | Grado de preparación operativa para la apertura. |
| **F&B Readiness** | Grado de preparación del área de restauración (food & beverage). |
| **Pricing** | Estructura y datos de precios. |
| **Commercial** | Datos comerciales del portfolio. |
| **BP & Budget** | Plan de negocio y presupuesto frente a lo comprometido. |
| **Risks & Actions** | Riesgos abiertos y acciones asociadas. |
| **Decisions** | Decisiones pendientes de tomar (hay **6 abiertas** ahora mismo). |

> **Importante para las pruebas:** los paneles muestran datos estructurados **solo de MAD y BHX**. Los proyectos KLP, GVF y PHILAE existen en los documentos (los verás en el chat), pero **no tienen cifras en estos paneles** — es así por diseño, no es un fallo.

### Bloque "Knowledge System" — el motor documental
| Página | Para qué sirve |
|---|---|
| **Document Bot** (`/chat`) | El asistente conversacional. Aquí preguntas y obtienes respuestas con fuentes citadas. **Es la prueba estrella.** |
| **Document Ingestion** (`/admin/ingest`) | Subir documentos y dejarlos en la cola durable. El worker programado los procesa en segundo plano; no hay botón de "procesar ahora". |
| **Evidence Review** (`/admin/review`) | Revisar las **cifras candidatas** que el sistema ha extraído: aceptarlas o rechazarlas antes de que lleguen a los paneles. |
| **Gestor Documental** (`/admin/documents`) | Gobernar el archivo: buscar documentos, **aprobar / reclasificar / retirar**, ver su autoridad y nivel de verificación. |
| **Pack Grounding** (`/admin/packs`) | Gestionar los *packs* de reporting (agrupaciones de cifras validadas). |

---

## 5. Cómo usar bien el Document Bot

El asistente está en **Document Bot** (`/chat`). Algunas claves para sacarle partido:

- **Pregunta en español y en lenguaje natural.** No hace falta sintaxis especial. Ejemplos que ya vienen sugeridos en la pantalla de inicio del chat:
  - *"¿Cuál es el estado actual del CapEx de Madrid?"*
  - *"Compara la utilización de financiación entre MAD y BHX"*
  - *"¿Cuánto queda de CESCE sin disponer?"*
  - *"¿Cuál es la desviación del EAC en Birmingham?"*
  - *"Resumen de flujo de caja de ambos proyectos"*
- **Cubre datos del deal y documentos de MAD y BHX**, y también puede buscar en documentos de Kelpa (KLP), el fondo (PHILAE) y el portfolio (GVF), aunque para estos últimos el filtrado por proyecto es más limitado.
- **Cada respuesta cita sus fuentes.** Debajo de la respuesta verás la lista de **fuentes desplegada por defecto**. Para cada una se muestra: el **nombre del documento** (a veces es un enlace), el **% de relevancia**, el **proyecto**, el **tipo de documento**, el **nivel de verificación** (*source of record* / *supporting* / *context* / *unverified*) y la **autoridad**. Puedes ocultarlas o volver a mostrarlas con el botón "Ocultar fuentes / Ver N fuentes".
- **Ten paciencia con las preguntas complejas.** No hay respuesta en streaming: una consulta que combina varias herramientas **puede tardar hasta ~2 minutos**. Verás un texto de progreso que va cambiando ("Buscando documentos…", "Analizando cifras…", "Verificando fuentes…"). Si pasa de ~2 minutos, el sistema lo cancela y te invita a reformular.
- **"Nueva conversación"** (arriba a la derecha) borra el hilo y empieza de cero.
- **Cuidado con la moneda en BHX:** algunas cifras de Birmingham están almacenadas en **euros** aunque la página pueda mostrar el símbolo de libra (£). Si algo te chirría con la divisa de BHX, anótalo, pero no asumas que el importe está mal.

---

## 6. Qué pinta tiene un buen resultado ("good looks like")

Cuando pruebes, esto es lo que **deberías** ver si todo funciona:

- **Login:** entras con contraseña o enlace mágico y aterrizas en el CEO Dashboard sin bucles ni errores.
- **Chat:** obtienes una respuesta **coherente, en español, con cifras concretas** y, **debajo, una lista de fuentes** con proyecto, tipo, verificación y autoridad. La respuesta no se contradice con lo que dicen sus propias fuentes.
- **Paneles:** el CEO Dashboard y las páginas de dominio cargan **datos reales de MAD y BHX** (importes, hitos, riesgos, decisiones), no pantallas vacías ni "próximamente".
- **Gestor Documental:** puedes buscar/filtrar documentos y los botones **Aprobar, Rechazar, Reclasificar, Retirar** responden y la fila se actualiza.
- **Evidence Review:** ves cifras candidatas con su confianza y fuente, y los botones **Accept / Reject** funcionan y mueven el candidato de estado.

**Señales de que algo va mal (a reportar):** mensajes de error, pantallas en blanco, una respuesta del chat **sin fuentes**, una respuesta que **contradice** sus fuentes, cifras claramente incoherentes, o que te expulse a `/login` repetidamente.

---

## 7. Qué probar primero (quick-start, 5 minutos)

Sigue este camino mínimo; es el flujo de negocio crítico de la aplicación:

1. **Entra** en `/login` con tu cuenta (contraseña o enlace mágico). → *Deberías llegar al CEO Dashboard.*
2. **Pregúntale algo al Document Bot.** Ve a **Document Bot** (`/chat`) y lanza, por ejemplo, *"¿Cuál es el estado actual del CapEx de Madrid?"*. → *Deberías recibir una respuesta con cifras **y con fuentes citadas** debajo.* Despliega una fuente y comprueba que indica proyecto, tipo y verificación.
3. **Gobierna un documento.** Ve a **Gestor Documental** (`/admin/documents`), abre cualquier documento de la lista y prueba **Aprobar** o **Reclasificar** (o **Retirar** y luego **Restaurar**). → *La acción debe confirmarse y reflejarse en la fila.*
4. **Revisa una cifra candidata.** Ve a **Evidence Review** (`/admin/review`), elige un candidato "Pending Review" y pulsa **Accept** o **Reject**. → *El candidato cambia de estado.*
5. **Lee los paneles.** Vuelve al **CEO Dashboard** y date una vuelta por **Funding & Cash**, **Risks & Actions** y **Decisions**. → *Deberías ver datos reales de MAD y BHX.*

Cuando termines este camino, ya habrás tocado las cuatro capas del sistema. A partir de ahí, sigue los casos de prueba detallados que te indique el responsable del UAT.

---

*Recuerda: si te bloqueas en el acceso, usa el enlace mágico o avisa a un administrador. Y ante cualquier comportamiento extraño, anótalo con el máximo detalle (página, qué hiciste, qué esperabas, qué ocurrió). ¡Gracias por probar!*
