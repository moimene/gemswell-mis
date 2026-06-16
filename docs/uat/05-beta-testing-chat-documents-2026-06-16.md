# Guia beta - Chat y Biblioteca documental (2026-06-16)

Objetivo: que un beta tester pueda probar el flujo critico documental sin tocar la base de datos:

1. Subir un documento.
2. Ver que entra en cola y queda indexado.
3. Buscarlo/gobernarlo en la biblioteca.
4. Preguntar por el en el chat, por contenido o por existencia.
5. Reportar incidencias con evidencia util.

App: `https://gemswell-mis-app.vercel.app`

## Cuentas

Cuenta tester admin ya verificada en produccion:

- Email: `bot@gemswell.surf`
- Password: `test2026`

Para crear o resetear mas testers con password conocido:

```bash
tsx scripts/create-tester-admin.ts <email> <password>
```

El script es idempotente: si el usuario existe, resetea password y re-afirma `role=admin`.
No se han creado cuentas adicionales en esta pasada porque no se proporcionaron emails nuevos.

## Que probar en `/admin/documents`

### Subida nueva

1. Abrir `Biblioteca documental`.
2. Pulsar `Subir documento`.
3. Elegir archivo soportado: PDF, DOCX, XLSX, XLS, CSV, TXT o PPTX, maximo 50 MB.
4. Opcional: elegir `Proyecto` y `Tipo`.
5. Pulsar `Subir y encolar`.
6. Esperado: aparece un toast indicando que el documento se ha encolado. El procesamiento sigue en segundo plano.
7. Para ver el job, abrir `Ingesta documental` y mirar `Cola durable`.
8. Esperado: `en cola` -> `procesando` -> `indexado` en menos de unos 10 minutos para documentos normales.
9. Volver a `Biblioteca documental`, buscar por titulo, abrir la ficha y revisar metadata/chunks/markdown.

### Gobierno documental

Probar con un documento no critico:

- Buscar por titulo.
- Abrir la ficha.
- Aprobar, reclasificar, retirar/restaurar si aplica.
- Esperado: la accion se confirma y la fila/ficha queda actualizada.

### Errores de ingesta

1. Activar filtro de errores en la biblioteca si hay un documento fallido.
2. Abrir la ficha.
3. Esperado: se ve `Error ingesta`, motivo del fallo, `Reintentar ingesta` y `Borrar fallido`.
4. `Reintentar ingesta` debe crear un job nuevo.
5. `Borrar fallido` debe eliminar la ficha fallida y sus artefactos recuperables.

Nota: los PDFs escaneados o sin texto pueden fallar si el parser no extrae contenido util. Eso no debe quedar invisible: debe aparecer como error recuperable/borrable.

## Que probar en `/chat`

### Existencia de documentos

Preguntar por titulo exacto o parcial:

```text
Esta subido el documento <nombre-del-archivo>?
```

Esperado:

- El chat usa la herramienta de existencia (`find_document`).
- Responde si el documento esta subido, indexado o si la ingesta fallo.
- Muestra `Como se obtuvo` con la herramienta usada.

### Contenido documental

Preguntar por un dato que deba venir de documentos:

```text
Que dice el contrato/documento X sobre Y?
```

Esperado:

- Respuesta en espanol.
- Fuentes citadas cuando usa contenido documental.
- Las fuentes `needs_review` aparecen marcadas como sin revisar.

### Historial

1. Crear una conversacion nueva.
2. Enviar una pregunta.
3. Confirmar que aparece en la barra lateral.
4. Recargar la pagina.
5. Esperado: la conversacion se reanuda con mensajes y herramientas.
6. Borrar la conversacion desde la `x`.
7. Esperado: desaparece de la barra lateral y el chat vuelve al estado inicial.

Smoke prod 2026-06-16:

- Login tester OK.
- `find_document` OK con `ZZZ_GEMSWELL_BETA_E2E_ASYNC_UPLOAD_20260616T133105Z.pdf`.
- Sidebar list/reload/delete OK.
- Badge live `Modo contingencia (Gemini) - Claude no disponible` OK durante la respuesta.
- Limitacion menor: tras recargar una conversacion historica, el texto y herramientas se restauran, pero el badge Gemini no se vuelve a pintar porque `rag_messages` no guarda metadata de proveedor. No bloquea la beta; registrar como mejora si se quiere persistencia visual perfecta.

## Modos de grounding

En la parte superior del chat:

- `Todas`: modo `standard`. Usa documentos aprobados y tambien `needs_review`, con disclosure.
- `Revisadas`: modo `trusted_only`. Excluye fuentes no revisadas.
- `Oficiales`: modo `official_only`. Solo fuentes de mayor confianza.

Recomendacion para beta: mantener `Todas` como default. Motivo: la beta debe validar tambien documentos nuevos recien subidos, que entran como `needs_review`; si el default fuera `Revisadas`, un tester podria subir un documento valido y no verlo en chat hasta aprobarlo. Para respuestas operativas de decision, pedir al tester que cambie manualmente a `Revisadas` u `Oficiales`.

Decision pendiente del usuario: confirmar si la beta arranca con default `standard` (`Todas`) o si prefiere cambiar el default a `trusted_only` antes de abrirlo.

## LLM y facturacion

Estado actual:

- Claude/Anthropic sigue como primario en codigo.
- El workspace de Anthropic esta capado por limite de gasto hasta 2026-07-01.
- Mientras Anthropic devuelve limite de uso, el chat cae a Gemini y muestra el badge de contingencia.
- El smoke de produccion funciona con Gemini.

Opciones:

1. Subir el limite de gasto en Anthropic Console para recuperar Claude como primario.
   - Recomendado si la beta busca maxima calidad documental.
   - Solo puede hacerlo el usuario/owner de billing.
2. Mantener Gemini para beta.
   - Recomendado si no se quiere tocar billing antes de empezar.
   - Modelo actual: `gemini-2.5-pro`; calidad alta, latencia a veces alta.
3. Cambiar `GEMINI_CHAT_MODEL=gemini-2.5-flash`.
   - Recomendado solo si los testers reportan que la latencia bloquea.
   - Tradeoff: mas rapido, potencialmente menor calidad de razonamiento/verificacion.

Recomendacion practica: arrancar beta con Gemini Pro si la latencia observada es aceptable; subir limite de Anthropic antes de una demo ejecutiva o uso de alta confianza.

## Como reportar incidencias

Para cada incidencia:

- Pantalla: `/chat`, `/admin/documents`, `/admin/ingest`, etc.
- Usuario usado.
- Hora aproximada.
- Pasos exactos.
- Resultado esperado.
- Resultado observado.
- Nombre del documento o pregunta exacta.
- Captura si hay UI rota.
- Si es chat: copiar respuesta completa y fuentes mostradas.
- Si es ingesta: copiar filename y estado del job si aparece.

Severidad sugerida:

- Alta: login bloqueado, upload no encola, job queda invisible, chat no responde, respuesta sin fuentes cuando deberia citarlas.
- Media: respuesta incompleta, fuente incorrecta, accion de gobierno no refresca, fallo recuperable con workaround.
- Baja: copy confuso, badge/estado visual no persistente, lentitud ocasional no bloqueante.
