# Gemswell MIS — Limitaciones conocidas y alcance de la UAT

**Documento para testers (equipo y stakeholders) · UAT tras el corte de autenticación C1**

---

## Cómo leer este documento

Este documento describe comportamientos del sistema que **ya conocemos y que son esperados**. Antes de abrir una incidencia ("bug"), comprueba si lo que has observado aparece en esta lista. Si está aquí:

- **NO es un fallo.** Es una decisión de diseño, una funcionalidad aplazada a una fase posterior, o una limitación de los datos cargados.
- **No hace falta que abras una incidencia.** Si crees que el comportamiento debería cambiar, déjalo como comentario o sugerencia, no como bug.

Si observas algo que **no** aparece aquí y te parece incorrecto, eso sí es candidato a incidencia. Anótalo con: en qué pantalla estabas, qué hiciste, qué esperabas y qué viste.

> Resumen en una frase: lo que está en esta lista es "así funciona hoy a propósito". Lo que no esté, repórtalo.

---

## 1. El chat (Document Bot) no escribe en tiempo real y puede tardar

**Dónde:** Document Bot (`/chat`), pantalla "Asistente MIS".

**Qué vas a observar:**
- Al enviar una pregunta, **no verás el texto aparecer palabra a palabra** (no hay "streaming"). Verás unos puntos animados y un texto de progreso que va rotando: *"Buscando documentos…"*, *"Analizando cifras…"*, *"Verificando fuentes…"*.
- Para preguntas sencillas la respuesta llega en segundos. Para preguntas que obligan al asistente a consultar varias fuentes y cruzar cifras, **puede tardar hasta cerca de 2 minutos**.
- Si una consulta supera los **120 segundos**, se cancela sola y verás el mensaje: *"La consulta tardó demasiado y se canceló. Inténtalo de nuevo o reformúlala."*

**Por qué es esperado:** El asistente hace un trabajo real por debajo (búsqueda en el corpus, reordenado de resultados y redacción con citas verificadas). Esa espera es normal. El texto de progreso que rota está ahí precisamente para que sepas que sigue trabajando y no se ha colgado.

**No es un bug:** ni la ausencia de escritura en tiempo real, ni que una respuesta compleja tarde uno o dos minutos, ni el mensaje de cancelación por tiempo. Si una consulta se cancela, vuelve a intentarlo o reformúlala de forma más concreta.

---

## 2. El chat solo sabe filtrar por proyecto para MAD y BHX

**Dónde:** Document Bot (`/chat`).

**Qué vas a observar:**
- Cuando preguntas algo y mencionas **Madrid (MAD)** o **Birmingham (BHX)**, el asistente acota la búsqueda a ese proyecto. El proyecto se deduce **del texto de tu pregunta**.
- Si preguntas por **Kelpa (KLP)**, el **fondo (PHILAE)** o la **cartera global (GVF)**, el asistente **sí puede encontrar y citar** esos documentos (siguen siendo buscables en todo el corpus), pero **no aplica un filtro por proyecto** sobre ellos como hace con MAD/BHX.

**Por qué es esperado:** El acotado automático por proyecto en el chat está implementado de momento solo para MAD y BHX. Para KLP/PHILAE/GVF la búsqueda es transversal (cross-project), no filtrada.

**No es un bug:** que una pregunta sobre Kelpa, el fondo o la cartera traiga resultados de todo el corpus en lugar de filtrar por ese proyecto. La información sigue siendo accesible; lo que no hay todavía es el filtro por proyecto para esos tres.

**Consejo para el tester:** si quieres acotar a un proyecto concreto que no sea MAD o BHX, sé muy específico en el texto de la pregunta (nombra el documento, la fecha o el concepto), porque el sistema no va a restringir la búsqueda por ti.

---

## 3. Cuidado con la divisa en Birmingham (BHX): puede aparecer £ donde el dato está en €

**Dónde:** páginas con cifras monetarias de **Birmingham (BHX)** — Funding & Cash, Pricing, Commercial, BP & Budget, Portfolio, dashboard.

**Qué vas a observar:**
- Las cifras de Birmingham se **almacenan en euros** (campo interno `amount_eur`), pero **algunas pantallas las etiquetan con el símbolo de libra (£ / GBP)**.
- Es decir, puedes ver una cifra de BHX presentada como libras cuando el valor guardado es en euros.

**Por qué es esperado:** la conversión/etiquetado de divisa para BHX aún no está unificado en toda la aplicación. Es una inconsistencia conocida de presentación, no un error de cálculo.

**No es un bug:** que el símbolo de divisa en cifras de Birmingham no sea coherente. **Trata cualquier símbolo de divisa de BHX con cautela** y no des por hecho que £ significa que el dato está convertido a libras. Si una cifra de BHX te parece mal, antes de reportarla comprueba si lo que falla es solo la **etiqueta de divisa** (esperado) o el **número en sí** (eso sí sería reportable).

---

## 4. La divisa es a nivel de proyecto, no por instrumento

**Dónde:** Funding & Cash, Pricing, Commercial.

**Qué vas a observar:**
- Cada proyecto tiene **una única divisa** para todo. Funding, pricing y commercial usan esa divisa de proyecto.
- Si un instrumento de financiación concreto estuviera originalmente en otra moneda, **no verás divisas distintas por instrumento**: todo se presenta con la divisa del proyecto.

**Por qué es esperado:** el modelo de datos actual maneja la divisa a nivel de proyecto, no a nivel de instrumento individual.

**No es un bug:** que todos los instrumentos de un mismo proyecto compartan divisa y no haya una moneda específica por instrumento.

---

## 5. La ingesta de documentos solo ENCOLA archivos; el procesado lo hace un operador

**Dónde:** Document Ingestion (`/admin/ingest`).

**Qué vas a observar:**
- Verás la lista de archivos del repositorio documental con su proyecto, categoría, relevancia y versión.
- Por seguridad, **al entrar no hay nada seleccionado**. Para seleccionar usa "Seleccionar relevantes / Auto-select high" (marca los de relevancia ≥ 75) o marca archivos a mano.
- Al pulsar "Queue … for Ingestion" te pedirá confirmar y, tras confirmar, los archivos quedan marcados como **`queued` (en cola)**.
- **Aquí termina lo que hace la pantalla.** El procesado real (leer, trocear e indexar el documento) **NO lo dispara este botón**: lo ejecuta después un operador o un proceso por línea de comandos (el *ingest-worker*).

**Por qué es esperado:** la pantalla de ingesta es para **poner archivos en cola**, no para procesarlos en el momento. El procesado es un paso operativo separado.

**No es un bug:**
- que un archivo se quede en estado `queued` y **no aparezca de inmediato** en el chat o en el corpus: aún no se ha procesado.
- que **no exista un botón** que "procese ahora" desde la interfaz.

**Además — OCR no está conectado:** los documentos que sean imágenes o PDFs escaneados (sin texto seleccionable) **no se reconocen por OCR**. No esperes que el sistema extraiga texto de un PDF escaneado.

---

## 6. No hay pantalla para restablecer contraseña

**Dónde:** Login (`/login`).

**Qué vas a observar:**
- Puedes entrar con **email + contraseña** (la de tu cuenta de admin sembrada) o pedir un **enlace mágico** ("Enviar enlace mágico") que te llega por email.
- **No hay un enlace de "¿Olvidaste tu contraseña?"** ni un flujo de auto-restablecimiento.

**Por qué es esperado:** la interfaz de restablecimiento de contraseña aún no está construida.

**Qué hacer si no puedes entrar (no es un bug):**
- Usa el **enlace mágico**: introduce tu email y pulsa "Enviar enlace mágico"; recibirás un enlace de acceso por correo.
- O pide a un administrador que **vuelva a sembrar / regenere** tu cuenta.

**Notas sobre el acceso, también esperadas:**
- El enlace mágico **solo funciona para cuentas de admin ya sembradas**: no crea cuentas nuevas. Si pones un email que no es de un admin sembrado, no se creará ninguna cuenta.
- Si tu enlace mágico **caduca o no es válido**, verás el aviso: *"El enlace de acceso caducó o no es válido. Solicita uno nuevo."* Simplemente pide otro.
- Una cuenta que se autentica pero **no es admin** quedará **denegada** tras el login (la rebota la capa de autorización). Es el comportamiento previsto: la app es **solo para administradores**.

---

## 7. Solo administradores; todo requiere haber iniciado sesión

**Dónde:** toda la aplicación.

**Qué vas a observar:**
- **Cada página exige login.** Si intentas abrir cualquier pantalla sin haber entrado, te manda al login.
- Las llamadas internas a `/api/*` devuelven **401** si no hay sesión. Esto puede pasar también **a mitad de uso** si tu sesión expira: por ejemplo, en el chat se te redirige al login conservando dónde estabas.
- Quien no sea admin **no puede usar la app**, aunque tenga credenciales válidas.

**Por qué es esperado:** tras el corte C1, el acceso es **solo para administradores** y la sesión es obligatoria en todas partes.

**No es un bug:** que te pida login en cualquier pantalla, que un 401 te devuelva al login si la sesión caducó, o que una cuenta no-admin sea rechazada.

---

## 8. Alcance de los datos: hechos estructurados solo para MAD + BHX; KLP/GVF/PHILAE solo en documentos

Esta es la limitación de datos más importante de entender para no confundir "no hay dato" con "hay un fallo".

**Qué vas a observar:**

- **Los cuadros de mando y las páginas de dominio** (CEO Dashboard, Portfolio, Critical Path, Funding & Cash, Ops Readiness, F&B Readiness, Pricing, Commercial, BP & Budget, Risks & Actions, Decisions) muestran datos estructurados **solo de dos proyectos: Madrid Playa Surf (MAD) y Birmingham (BHX)**.
- Las tablas de hechos del sistema (CapEx, financiación, tesorería, pricing, readiness, riesgos, decisiones) contienen **únicamente MAD y BHX**.
- **Kelpa (KLP), el fondo (PHILAE) y la cartera global (GVF)** **no tienen datos estructurados** en estas pantallas. **No esperes verlos** en dashboards ni en las páginas de dominio.
- Esos tres proyectos **sí existen en el corpus documental** y son **accesibles a través del Document Bot** (`/chat`), porque sus documentos están cargados. Lo que no tienen es cifras estructuradas que alimenten dashboards.

**Por qué es esperado:** el modelo de datos de hechos se ha poblado **a propósito** solo para MAD y BHX. Que el dashboard se ciña a estos dos proyectos es una decisión de diseño, no un olvido.

**No es un bug:**
- que **no aparezcan KLP, PHILAE ni GVF** en el dashboard ni en ninguna página de cifras.
- que el chat **sí** sepa contestar sobre documentos de KLP/PHILAE/GVF aunque el dashboard no los muestre. Las dos cosas son coherentes: documentos sí, cifras estructuradas no.

**Para qué proyecto usar cada cosa:**

| Proyecto | En dashboards y páginas de cifras | En el Document Bot (`/chat`) |
|----------|:---------------------------------:|:----------------------------:|
| MAD (Madrid) | Sí | Sí (con filtro por proyecto) |
| BHX (Birmingham) | Sí (ojo a la divisa, ver punto 3) | Sí (con filtro por proyecto) |
| KLP (Kelpa) | No | Sí (búsqueda transversal) |
| PHILAE (fondo) | No | Sí (búsqueda transversal) |
| GVF (cartera) | No | Sí (búsqueda transversal) |

---

## Resumen rápido para el tester

Antes de abrir una incidencia, descarta estos comportamientos **esperados**:

1. El chat **no escribe en directo** y puede tardar **hasta ~2 min**; a los 120 s se cancela solo.
2. El chat **solo filtra por proyecto** para **MAD y BHX**; KLP/PHILAE/GVF se buscan en todo el corpus sin filtro.
3. En **BHX** el símbolo de divisa puede ser **£** aunque el dato esté en **€**: trátalo con cautela.
4. La **divisa es por proyecto**, no por instrumento de financiación.
5. La pantalla de ingesta **solo encola** archivos (`queued`); el procesado lo hace un operador aparte, y **no hay OCR**.
6. **No hay restablecimiento de contraseña**: usa **enlace mágico** o pide reseed a un admin.
7. **Solo admins**, y **todo requiere login**: un 401 o un rebote al login es lo previsto.
8. **Dashboards y cifras = solo MAD + BHX.** KLP/PHILAE/GVF existen **solo como documentos** (accesibles en el chat).

Cualquier comportamiento que **no** esté en esta lista y te parezca incorrecto: anótalo y repórtalo con pantalla, pasos, resultado esperado y resultado observado.
