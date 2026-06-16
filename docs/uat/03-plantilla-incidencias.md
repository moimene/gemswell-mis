# Plantilla y guía de incidencias — UAT Gemswell MIS

Este documento te ayuda a **reportar una incidencia (bug)** durante las pruebas de aceptación (UAT) de Gemswell MIS de forma clara y útil. No necesitas conocimientos técnicos: solo describe lo que viste, paso a paso.

> **Regla de oro:** una buena incidencia es la que **otra persona puede reproducir** leyendo tu reporte, sin preguntarte nada. Si dudas entre poner más o menos detalle, pon más.

> **Confidencialidad:** Gemswell MIS contiene cifras reales de los proyectos (Madrid Playa Surf = **MAD**, Birmingham = **BHX**, y documentos de KLP/GVF/PHILAE). No pegues capturas ni cifras en canales públicos. Comparte las incidencias solo por el canal interno acordado para la UAT.

---

## 1. Cómo reportar (resumen rápido)

1. Cuando algo falle, **no cierres la página todavía**. Haz una captura de pantalla primero.
2. Apunta la **URL exacta** que aparece en la barra del navegador (por ejemplo `/chat`, `/admin/documents`, `/admin/review`, o `/` para el panel CEO).
3. Copia la plantilla de la sección 3, rellénala y envíala por el canal de la UAT.
4. Si la app muestra un mensaje de error en pantalla (un aviso, un texto en rojo, una notificación que aparece arriba), **copia ese texto literal** en el reporte.

---

## 2. Rúbrica de severidad

Asigna **una** severidad a cada incidencia. Si dudas entre dos, elige la más alta y coméntalo. Los ejemplos están basados en esta app concreta.

| Severidad | Qué significa | Ejemplos reales en Gemswell MIS |
|-----------|---------------|----------------------------------|
| **Crítico** | Bloquea por completo el uso. No hay forma de continuar y afecta a todos los testers. | • No puedo **iniciar sesión** con mi cuenta de admin (ni con contraseña ni con enlace mágico). <br>• El **Document Bot** (`/chat`) no responde a ninguna pregunta o devuelve siempre error. <br>• Una página clave (panel CEO `/`, `/admin/documents`) da error y no carga nunca. <br>• Aprobar/retirar un documento **borra o corrompe** datos. |
| **Alto** | Una función importante no funciona, pero existe un rodeo o solo afecta a una parte. | • El chat responde pero **no muestra las fuentes/citas** (siendo que deberían salir desplegadas por defecto). <br>• En `/admin/review` no puedo **aprobar ni rechazar** un candidato de métrica (el botón no hace nada). <br>• En `/admin/documents` el botón de **aprobar / reclasificar / retirar** falla o no guarda el cambio. <br>• Un dashboard (Funding, Pricing, Risks…) muestra cifras claramente **incorrectas o contradictorias**. |
| **Medio** | Molesto o confuso, pero se puede trabajar. Comportamiento incorrecto sin pérdida de datos. | • Un filtro de `/admin/documents` (proyecto, tipo, "solo pendientes de revisión") no filtra bien. <br>• El chat tarda mucho y no se entiende si está pensando o se ha colgado. <br>• Una respuesta del bot mezcla proyectos (cita un documento de BHX cuando pregunté por MAD). <br>• Un símbolo de moneda **dudoso** en BHX (ver sección 6). |
| **Bajo** | Detalle estético o cosmético. No afecta a los datos ni al uso. | • Una **cifra mal alineada** o un texto que se sale de su caja. <br>• Una errata, un acento o una traducción rara. <br>• Un color, icono o espaciado que se ve raro. <br>• Un tooltip que no aparece. |

**Si no estás seguro de si es un bug o es así a propósito:** repórtalo igual como **Medio** y escribe en el título "(¿comportamiento esperado?)". Es mejor preguntar que dejarlo pasar.

> **Antes de reportar, revisa las limitaciones conocidas** (documento `04-limitaciones-conocidas.md`). Algunas cosas **ya sabemos** que funcionan así en esta fase y **no son bugs**, por ejemplo: el chat puede tardar con preguntas complejas; `/admin/ingest` y `/admin/documents` **encolan** archivos y el procesado lo hace el worker en segundo plano; no hay aún pantalla de recuperación de contraseña. Si tu incidencia coincide con una limitación conocida, no hace falta reportarla.

---

## 3. Plantilla de incidencia (copia y rellena)

Copia el bloque siguiente, rellena cada campo y envíalo. Borra los textos de ayuda entre paréntesis.

```
─────────────────────────────────────────────
TÍTULO:
(Una frase corta y concreta. Mal: "No funciona". Bien: "El chat no muestra las
fuentes al preguntar por el CapEx de MAD")

PÁGINA / URL:
(Lo que aparece en la barra del navegador. Ej.: /chat , /admin/documents ,
/admin/review , / (panel CEO), /funding ...)

SEVERIDAD:
(Crítico / Alto / Medio / Bajo — ver rúbrica)

PASOS PARA REPRODUCIR:
1.
2.
3.
(Numerados. Empieza siempre desde "Inicié sesión y fui a ...". Incluye el texto
EXACTO que escribiste o el botón EXACTO que pulsaste.)

RESULTADO ESPERADO:
(Qué creías que iba a pasar)

RESULTADO OBTENIDO:
(Qué pasó en realidad. Copia LITERAL cualquier mensaje de error en pantalla.)

CAPTURA / EVIDENCIA:
(Adjunta imagen. Si hay un mensaje de error, pega también el texto.)

NAVEGADOR / DISPOSITIVO:
(Ej.: Chrome 124 en Mac / Safari en iPhone / Edge en Windows)

USUARIO (email admin):
(Con qué cuenta entraste)

FECHA Y HORA:
(Ej.: 2026-06-06, 11:40 — la hora ayuda a cruzar con los registros del sistema)

¿REPETIBLE?:
(¿Pasa siempre / a veces / solo una vez?)
─────────────────────────────────────────────
```

---

## 4. Cómo escribir buenos "pasos para reproducir"

Los pasos son la parte más importante. Sigue estas tres normas:

1. **Empieza desde el principio conocido.** El primer paso casi siempre es *"Inicié sesión en `/login` con mi cuenta de admin"*. Así quien lo lea parte del mismo sitio que tú.
2. **Un paso = una acción.** No metas tres cosas en una línea. Indica el **dato exacto** (la pregunta que escribiste en el chat, el filtro que elegiste, el documento que abriste).
3. **Marca el momento exacto del fallo.** El último paso debe ser donde algo se rompe ("…pulsé *Aprobar* y no pasó nada").

**Ejemplo flojo (no hagas esto):**
> "El chat no va bien."

**Ejemplo bueno (haz esto):**
> 1. Inicié sesión en `/login` con mi cuenta de admin.
> 2. Fui a Document Bot (`/chat`).
> 3. Escribí: "¿Cuál es el estado actual del CapEx de Madrid?" y pulsé enviar.
> 4. Tras ~30 s apareció la respuesta, pero **no salió ninguna fuente/cita** debajo.

Detalles útiles que conviene incluir cuando apliquen:
- **El texto exacto** de tu pregunta al bot (cópialo, no lo resumas).
- **Qué proyecto** estabas mirando (MAD o BHX), porque el chat infiere el proyecto del texto de tu pregunta.
- **Qué filtros** tenías puestos en `/admin/documents` o `/admin/review`.
- Si la página **tardó mucho**, indica cuánto esperaste (el chat puede tardar hasta ~2 min en preguntas con varias herramientas; eso es esperado, no un bug).
- El **mensaje de error literal** si lo hubo (p. ej. avisos en rojo, o un código tipo `401`).

---

## 5. Ejemplo de incidencia rellenada

```
─────────────────────────────────────────────
TÍTULO:
El chat no muestra las fuentes al preguntar por el CapEx de MAD

PÁGINA / URL:
/chat

SEVERIDAD:
Alto
(El valor del producto es la respuesta CON citas de fuentes; sin ellas no puedo
verificar la respuesta. Hay rodeo: puedo buscar el documento a mano en /admin/documents.)

PASOS PARA REPRODUCIR:
1. Inicié sesión en /login con mi cuenta de admin (laura.gomez@gemswell.example).
2. Fui a Document Bot (/chat).
3. Hice clic en la pregunta sugerida "¿Cuál es el estado actual del CapEx de Madrid?".
4. Esperé ~40 s mientras mostraba "Buscando documentos… / Analizando cifras…".
5. Apareció una respuesta con la cifra del CapEx, pero SIN el bloque de fuentes debajo.

RESULTADO ESPERADO:
Debajo de la respuesta deberían aparecer las fuentes desplegadas por defecto, cada
una con su proyecto, tipo de documento, nivel de verificación y autoridad.

RESULTADO OBTENIDO:
La respuesta de texto salió bien, pero no apareció ninguna fuente ni bloque de citas.
Probé otra pregunta ("Resumen de flujo de caja de ambos proyectos") y esa SÍ mostró
fuentes, así que parece específico de esta consulta.

CAPTURA / EVIDENCIA:
[adjunto captura: chat-sin-fuentes-mad.png]

NAVEGADOR / DISPOSITIVO:
Chrome 124 en Mac (MacBook)

USUARIO (email admin):
laura.gomez@gemswell.example

FECHA Y HORA:
2026-06-06, 11:42

¿REPETIBLE?:
Sí, pasa siempre con esa pregunta concreta. Con otras preguntas las fuentes sí salen.
─────────────────────────────────────────────
```

---

## 6. Aviso especial sobre las monedas de BHX

Si tu incidencia es sobre una **cifra o símbolo de moneda** en Birmingham (**BHX**), revísalo con cuidado **antes** de reportarlo:

- Las cifras de BHX se guardan internamente en **euros**, pero algunas páginas las etiquetan como **GBP (£)**.
- Por eso, un símbolo de moneda "raro" en BHX **puede ser una limitación ya conocida**, no un bug nuevo.

Si reportas algo de moneda de BHX, **indica claramente** qué símbolo viste (€ o £), en qué página y junto a qué cifra. Eso nos permite distinguir entre la limitación ya conocida y un error real. Clasifícalo como **Medio** salvo que la cifra en sí sea claramente errónea (entonces **Alto**).

---

## 7. Checklist antes de enviar

- [ ] El **título** describe el problema en una frase concreta.
- [ ] Puse la **URL** exacta donde ocurrió.
- [ ] Los **pasos** empiezan desde el inicio de sesión y cualquiera podría seguirlos.
- [ ] Escribí **resultado esperado** y **resultado obtenido** por separado.
- [ ] Copié el **texto literal** de cualquier mensaje de error.
- [ ] Adjunté **captura**.
- [ ] Indiqué **navegador, usuario y fecha/hora**.
- [ ] Comprobé que **no** es una limitación conocida (documento `04-limitaciones-conocidas.md`).
- [ ] Asigné una **severidad** según la rúbrica.
