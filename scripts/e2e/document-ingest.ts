import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { chromium, type Browser, type Page } from 'playwright'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ingestBuffer, errorMessage } from '../../src/lib/ingest/queue-processor'
import type { SourceChannel } from '../../src/lib/knowledge/contracts'

config({ path: resolve(process.cwd(), '.env.local') })

type StepResult = {
  step: string
  ok: boolean
  details?: Record<string, unknown>
  screenshot?: string
}

type IngestJobRow = {
  id: string
  status: string
  attempts: number | null
  storage_bucket: string
  storage_path: string
  file_name: string
  file_ext: string | null
  file_size: number | null
  project_id: string | null
  doc_type_hint: string | null
  source_channel: string | null
  document_id: string | null
}

type CleanupState = {
  fileName: string
  jobId: string | null
  extraJobIds: Set<string>
  documentId: string | null
  storagePaths: Set<string>
  documentMayBeMissing?: boolean
}

type DocumentGovernanceSnapshot = {
  review_status: string | null
  classification_source: string | null
  project_id: string | null
  doc_type: string | null
  authority_score: number | null
  authority_tier: string | null
  status: string | null
}

type ProcessedJobResult = {
  status: 'done' | 'error'
  documentId: string | null
  chunks: number
  parser: string | null
  storagePath: string
  error?: string
}

const requestedPort = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : null
let baseUrl = process.env.E2E_BASE_URL || ''
const startServer = process.env.E2E_START_SERVER !== 'false' && !process.env.E2E_BASE_URL
const artifactDir = process.env.E2E_ARTIFACT_DIR || join(tmpdir(), 'gemswell-mis-e2e-doc-ingest')
const uploadBucket = process.env.KNOWLEDGE_ARTIFACT_BUCKET ?? 'documents'

function maskEmail(email: string): string {
  return email.replace(/^(.).+(@.*)$/, '$1***$2')
}

function assertText(text: string, checks: Array<[string, RegExp]>): Record<string, boolean> {
  return Object.fromEntries(checks.map(([name, re]) => [name, re.test(text)]))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.status >= 200 && res.status < 400) return
    } catch {
      // server not ready yet
    }
    await new Promise((resolveTick) => setTimeout(resolveTick, 500))
  }
  throw new Error(`Server did not become ready at ${url}`)
}

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolveFree) => {
    const server = createServer()
    server.once('error', () => resolveFree(false))
    server.once('listening', () => server.close(() => resolveFree(true)))
    server.listen(port, '127.0.0.1')
  })
}

async function findFreePort(startAt = 3102): Promise<number> {
  for (let port = startAt; port < startAt + 200; port++) {
    if (await isPortFree(port)) return port
  }
  throw new Error(`No free e2e port found starting at ${startAt}`)
}

function startNextServer(port: number): ChildProcess {
  const child = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  })
  child.stdout?.on('data', (chunk) => {
    if (process.env.E2E_VERBOSE_SERVER === 'true') process.stdout.write(chunk)
  })
  child.stderr?.on('data', (chunk) => {
    if (process.env.E2E_VERBOSE_SERVER === 'true') process.stderr.write(chunk)
  })
  return child
}

function newestCachedHeadlessShell(): string | null {
  const base = join(process.env.HOME || '', 'Library/Caches/ms-playwright')
  if (!existsSync(base)) return null
  const candidates = readdirSync(base)
    .filter((name) => name.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()
    .map((name) => join(base, name, 'chrome-headless-shell-mac-arm64/chrome-headless-shell'))
    .filter((file) => existsSync(file))
  return candidates[0] ?? null
}

function browserExecutable(): string | undefined {
  const explicit = process.env.E2E_CHROMIUM_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  if (explicit) return explicit
  const bundled = chromium.executablePath()
  if (existsSync(bundled)) return bundled
  const cached = newestCachedHeadlessShell()
  if (cached) return cached
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (existsSync(macChrome)) return macChrome
  const macEdge = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  if (existsSync(macEdge)) return macEdge
  return undefined
}

async function screenshot(page: Page, name: string): Promise<string> {
  mkdirSync(artifactDir, { recursive: true })
  const file = join(artifactDir, `${name}-${Date.now()}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function processJobById(sb: SupabaseClient, jobId: string, opts: { allowError?: boolean } = {}): Promise<ProcessedJobResult> {
  const { data: rawRow, error } = await sb
    .from('knowledge_ingest_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw new Error(`knowledge_ingest_jobs lookup failed: ${error.message}`)
  const row = rawRow as IngestJobRow | null
  if (!row) throw new Error(`knowledge_ingest_jobs row not found: ${jobId}`)

  const now = Date.now()
  const attempts = Number(row.attempts ?? 0) + 1
  const processing = await sb
    .from('knowledge_ingest_jobs')
    .update({
      status: 'processing',
      stage: 'e2e_processing',
      attempts,
      started_at: new Date(now).toISOString(),
      finished_at: null,
      lease_expires_at: new Date(now + 2 * 60 * 60_000).toISOString(),
      error_message: null,
    })
    .eq('id', jobId)
  if (processing.error) throw new Error(`knowledge_ingest_jobs processing update failed: ${processing.error.message}`)

  const { data: blob, error: downloadErr } = await sb.storage
    .from(row.storage_bucket)
    .download(row.storage_path)
  if (downloadErr || !blob) throw new Error(`uploaded blob download failed: ${downloadErr?.message ?? 'no blob returned'}`)

  const buffer = Buffer.from(await blob.arrayBuffer())
  const result = await ingestBuffer(sb, {
    fileName: row.file_name,
    fileExt: row.file_ext || extOf(row.file_name),
    buffer,
    projectId: row.project_id,
    docTypeHint: row.doc_type_hint,
    rawStoragePath: row.storage_path,
    sourceChannel: (row.source_channel || 'browser_upload') as SourceChannel,
  }, {
    embeddingBatchSize: 20,
    log: (message) => {
      if (process.env.E2E_VERBOSE_INGEST === 'true') console.log(JSON.stringify({ jobId, message }))
    },
  })

  if (result.status === 'error' || !result.documentId) {
    const message = (result.error ?? 'No se pudo procesar el documento').slice(0, 1000)
    await sb
      .from('knowledge_ingest_jobs')
      .update({
        status: 'error',
        stage: 'error',
        finished_at: new Date().toISOString(),
        lease_expires_at: null,
        document_id: result.documentId ?? row.document_id,
        error_message: message,
      })
      .eq('id', jobId)
    if (opts.allowError) {
      return {
        status: 'error',
        documentId: result.documentId ?? row.document_id,
        chunks: 0,
        parser: null,
        storagePath: row.storage_path,
        error: message,
      }
    }
    throw new Error(message)
  }

  const finished = await sb
    .from('knowledge_ingest_jobs')
    .update({
      status: 'done',
      stage: 'indexed',
      finished_at: new Date().toISOString(),
      lease_expires_at: null,
      document_id: result.documentId,
      chunks: result.chunks ?? 0,
      parser: result.parser ?? null,
      error_message: null,
    })
    .eq('id', jobId)
  if (finished.error) throw new Error(`knowledge_ingest_jobs done update failed: ${finished.error.message}`)

  return {
    status: 'done',
    documentId: result.documentId,
    chunks: result.chunks ?? 0,
    parser: result.parser ?? null,
    storagePath: row.storage_path,
  }
}

async function fetchGovernanceSnapshot(sb: SupabaseClient, documentId: string): Promise<DocumentGovernanceSnapshot> {
  const { data, error } = await sb
    .from('rag_documents')
    .select('review_status, classification_source, project_id, doc_type, authority_score, authority_tier, status')
    .eq('id', documentId)
    .maybeSingle()
  if (error) throw new Error(`rag_documents governance lookup failed: ${error.message}`)
  if (!data) throw new Error(`rag_documents row not found: ${documentId}`)
  return data as DocumentGovernanceSnapshot
}

async function waitForPatch(page: Page, documentId: string, action: () => Promise<void>) {
  const responsePromise = page.waitForResponse((resp) =>
    resp.url().includes(`/api/knowledge/documents/${documentId}`) &&
    resp.request().method() === 'PATCH' &&
    resp.status() === 200,
    { timeout: 60_000 },
  )
  await action()
  await responsePromise
}

async function askChatAboutIndexedUpload(page: Page, fileName: string, token: string): Promise<StepResult> {
  const question = `Que condicion de prueba indica el documento temporal ${token} y cual es su margen documental? Cita el documento fuente.`
  const checks: Array<[string, RegExp]> = [
    ['hasUniqueToken', new RegExp(escapeRegExp(token), 'i')],
    ['hasMargin', /7[.,]31\s*(?:por ciento|%)/i],
    ['hasSourceTitle', new RegExp(escapeRegExp(fileName), 'i')],
  ]

  await page.goto(`${baseUrl}/chat`, { waitUntil: 'networkidle' })
  await page.waitForSelector('textarea')
  const newConversation = page.getByRole('button', { name: /Nueva conversación/i })
  if (await newConversation.count()) await newConversation.click()
  await page.locator('textarea').fill(question)
  await page.locator('textarea').evaluate((el) => {
    const wrapper = el.closest('.flex.items-end')
    const button = wrapper?.querySelector('button') as HTMLButtonElement | null
    if (!button) throw new Error('send button not found')
    button.click()
  })
  await page.waitForFunction(
    (patterns) => {
      const text = document.body.innerText
      return (patterns as string[]).every((pattern) => new RegExp(pattern, 'i').test(text))
    },
    checks.map(([, re]) => re.source),
    { timeout: 300_000 },
  )
  const text = await page.locator('body').innerText()
  const details = assertText(text, checks)
  return {
    step: 'chat-recovers-newly-ingested-document',
    ok: Object.values(details).every(Boolean),
    details,
    screenshot: await screenshot(page, 'chat-newly-ingested-document'),
  }
}

async function cleanupConversations(sb: SupabaseClient, userKey: string): Promise<Record<string, unknown>> {
  const { data, error } = await sb
    .from('rag_conversations')
    .select('id')
    .eq('user_id', userKey)
  if (error) return { ok: false, error: error.message }

  const ids = (data ?? [])
    .map((row) => typeof row.id === 'string' ? row.id : null)
    .filter((id): id is string => Boolean(id))
  if (ids.length === 0) return { ok: true, conversationDeleted: true, messageDeleted: true, conversationCount: 0 }

  const messages = await sb.from('rag_messages').delete().in('conversation_id', ids)
  const conversations = await sb.from('rag_conversations').delete().in('id', ids)
  return {
    ok: !messages.error && !conversations.error,
    messageDeleted: !messages.error,
    conversationDeleted: !conversations.error,
    conversationCount: ids.length,
    messageDeleteError: messages.error?.message,
    conversationDeleteError: conversations.error?.message,
  }
}

async function cleanupUpload(sb: SupabaseClient, state: CleanupState): Promise<Record<string, unknown>> {
  const details: Record<string, unknown> = { jobDeleted: false, documentDeleted: false, storageRemoved: 0 }

  if (state.documentId) {
    const { data: doc } = await sb
      .from('rag_documents')
      .select('id, title, storage_path, md_path')
      .eq('id', state.documentId)
      .maybeSingle()
    if (!doc && state.documentMayBeMissing) {
      details.documentDeleted = true
      details.documentAlreadyMissing = true
    } else {
      const title = typeof doc?.title === 'string' ? doc.title : null
      if (title === state.fileName) {
        for (const path of [doc?.storage_path, doc?.md_path]) {
          if (typeof path === 'string' && path.length > 0) state.storagePaths.add(path)
        }
        await sb.from('rag_chunks').delete().eq('document_id', state.documentId)
        await sb.from('rag_document_events').delete().eq('document_id', state.documentId)
        const deleted = await sb.from('rag_documents').delete().eq('id', state.documentId)
        if (deleted.error) details.documentDeleteError = deleted.error.message
        else details.documentDeleted = true
      } else {
        details.documentDeleteSkipped = `title mismatch: ${title ?? '(missing)'}`
      }
    }
  } else {
    details.documentDeleted = true
    details.noDocumentToDelete = true
  }

  const jobIds = [state.jobId, ...state.extraJobIds].filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (jobIds.length > 0) {
    const deleted = await sb.from('knowledge_ingest_jobs').delete().in('id', jobIds)
    if (deleted.error) details.jobDeleteError = deleted.error.message
    else {
      details.jobDeleted = true
      details.jobDeletedCount = jobIds.length
    }
  } else {
    details.jobDeleted = true
    details.jobDeletedCount = 0
  }

  const paths = [...state.storagePaths].filter((path) => path.startsWith('uploads/') || path.startsWith('artifacts/'))
  if (paths.length > 0) {
    const removed = await sb.storage.from(uploadBucket).remove(paths)
    if (removed.error) details.storageRemoveError = removed.error.message
    else details.storageRemoved = paths.length
  }

  return details
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const token = `CODX${randomBytes(5).toString('hex').toUpperCase()}`
  const fileName = `codex-e2e-ingest-${Date.now()}-${token}.txt`
  const tempFile = join(tmpdir(), fileName)
  const content = [
    `Prueba e2e de ingesta documental ${token}.`,
    'Proyecto MAD. Tipo funding. Este documento temporal valida subida, cola durable, indexacion, ficha del gestor y descarga del original.',
    `El identificador unico de control es ${token} y la condicion de prueba indica margen documental 7.31 por ciento.`,
    'El texto supera el minimo de extraccion y debe quedar disponible como fragmento del corpus tras procesar el job.',
  ].join('\n')
  writeFileSync(tempFile, content, 'utf8')
  const failedToken = `BAD${randomBytes(5).toString('hex').toUpperCase()}`
  const failedFileName = `codex-e2e-failed-ingest-${Date.now()}-${failedToken}.pdf`
  const failedTempFile = join(tmpdir(), failedFileName)
  writeFileSync(failedTempFile, `not-a-valid-pdf-${failedToken}`, 'utf8')

  const cleanupState: CleanupState = { fileName, jobId: null, extraJobIds: new Set(), documentId: null, storagePaths: new Set() }
  let failedCleanupState: CleanupState | null = null
  const tempEmail = `codex-e2e-${Date.now()}@gemswell.local`
  const tempPassword = `CodexE2E-${randomBytes(12).toString('hex')}!aA1`
  let tempUserId: string | null = null
  let server: ChildProcess | null = null
  let browser: Browser | null = null
  let page: Page | null = null
  const results: StepResult[] = []
  const consoleMessages: string[] = []
  const failedRequests: string[] = []
  let failure: Record<string, unknown> | null = null
  let cleanup: Record<string, unknown> | null = null
  let conversationCleanup: Record<string, unknown> | null = null

  try {
    if (startServer) {
      const port = requestedPort ?? await findFreePort()
      baseUrl = `http://localhost:${port}`
      server = startNextServer(port)
      await waitForHttp(`${baseUrl}/login`)
    } else {
      if (!baseUrl) baseUrl = `http://localhost:${requestedPort ?? 3000}`
      await waitForHttp(`${baseUrl}/login`)
    }

    const created = await supabase.auth.admin.createUser({
      email: tempEmail,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { role: 'admin' },
    })
    if (created.error) throw created.error
    tempUserId = created.data.user.id

    const executablePath = browserExecutable()
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
    page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
    page.setDefaultTimeout(60_000)
    page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) consoleMessages.push(`${msg.type()}: ${msg.text()}`)
    })
    page.on('requestfailed', (req) => {
      const failureText = req.failure()?.errorText ?? 'unknown'
      if (!req.url().includes('_next/webpack') && failureText !== 'net::ERR_ABORTED') {
        failedRequests.push(`${req.method()} ${req.url()} :: ${failureText}`)
      }
    })

    await page.goto(`${baseUrl}/login?redirect=/admin/ingest`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#login-email')
    await page.fill('#login-email', tempEmail)
    await page.fill('#login-password', tempPassword)
    await page.getByRole('button', { name: /^Entrar$/ }).click()
    await page.waitForURL(/\/admin\/ingest/)
    await page.waitForSelector('text=Ingesta documental')
    results.push({ step: 'login-form-temp-admin', ok: true, details: { email: maskEmail(tempEmail) } })

    const signResponsePromise = page.waitForResponse((resp) =>
      resp.url().includes('/api/knowledge/upload/sign') && resp.request().method() === 'POST',
      { timeout: 120_000 },
    )
    const jobResponsePromise = page.waitForResponse((resp) =>
      resp.url().includes('/api/knowledge/ingest/jobs') && resp.request().method() === 'POST',
      { timeout: 120_000 },
    )

    await page.locator('input[type="file"]').setInputFiles(tempFile)
    await page.locator('select').nth(0).selectOption('MAD')
    await page.locator('select').nth(1).selectOption('funding')
    await page.getByRole('button', { name: /Subir y encolar/i }).click()

    const signPayload = await (await signResponsePromise).json() as { path?: string }
    if (signPayload.path) cleanupState.storagePaths.add(signPayload.path)
    const jobPayload = await (await jobResponsePromise).json() as { job?: { id?: string; status?: string; file_name?: string } }
    const jobId = jobPayload.job?.id
    if (!jobId) throw new Error('Upload did not return a job id')
    cleanupState.jobId = jobId
    await page.waitForFunction(
      (file) => document.body.innerText.includes(file) && /encolado|cola/i.test(document.body.innerText),
      fileName,
      { timeout: 60_000 },
    )
    results.push({
      step: 'ingest-ui-enqueues-upload',
      ok: true,
      details: { fileName, jobId, storagePath: signPayload.path ?? null },
      screenshot: await screenshot(page, 'ingest-upload-enqueued'),
    })

    const processed = await processJobById(supabase, jobId)
    if (processed.status !== 'done' || !processed.documentId) throw new Error(`Expected successful ingest, got ${processed.status}`)
    cleanupState.documentId = processed.documentId
    cleanupState.storagePaths.add(processed.storagePath)
    results.push({
      step: 'ingest-worker-indexes-upload',
      ok: processed.chunks > 0 && Boolean(processed.documentId),
      details: processed,
    })

    await page.goto(`${baseUrl}/admin/ingest`, { waitUntil: 'networkidle' })
    await page.waitForFunction(
      (file) => document.body.innerText.includes(file) && /indexado/i.test(document.body.innerText),
      fileName,
      { timeout: 90_000 },
    )
    const jobPanelText = await page.locator('body').innerText()
    const jobPanelChecks = assertText(jobPanelText, [
      ['hasFile', new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))],
      ['hasIndexedStatus', /indexado/i],
      ['hasFichaLink', /ficha/i],
    ])
    results.push({
      step: 'ingest-ui-shows-indexed-job-link',
      ok: Object.values(jobPanelChecks).every(Boolean),
      details: jobPanelChecks,
      screenshot: await screenshot(page, 'ingest-job-indexed'),
    })

    await page.locator(`a[href="/admin/documents?doc=${processed.documentId}"]`).first().click()
    await page.waitForURL(/\/admin\/documents\?doc=/, { timeout: 60_000 })
    await page.waitForSelector('text=Biblioteca documental')
    await page.waitForSelector(`text=${fileName}`, { timeout: 60_000 })
    await page.getByText(/Fragmentos \(/i).click()
    await page.waitForFunction(
      (needle) => document.body.innerText.includes(needle),
      token,
      { timeout: 60_000 },
    )
    const docText = await page.locator('body').innerText()
    const docChecks = assertText(docText, [
      ['hasFileTitle', new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))],
      ['hasProject', /Proyecto\s+MAD|MAD/i],
      ['hasDocType', /Tipo\s+funding|funding/i],
      ['hasBrowserUploadOrigin', /browser_upload/i],
      ['hasIndexedContent', new RegExp(token)],
      ['hasFragments', /Fragmentos \([1-9]\d*\)/i],
    ])
    results.push({
      step: 'documents-deeplink-opens-indexed-upload',
      ok: Object.values(docChecks).every(Boolean),
      details: docChecks,
      screenshot: await screenshot(page, 'documents-upload-detail'),
    })

    if (!page) throw new Error('page not initialized')
    const documentPage = page

    await waitForPatch(documentPage, processed.documentId, async () => {
      await documentPage.getByRole('button', { name: /Aprobar/i }).click()
    })
    await documentPage.waitForFunction(() => /Aprobado/i.test(document.body.innerText), null, { timeout: 60_000 })
    const approvedState = await fetchGovernanceSnapshot(supabase, processed.documentId)
    const approvedText = await documentPage.locator('body').innerText()
    const approvedChecks = {
      visibleApproved: /Aprobado/i.test(approvedText),
      rowApproved: approvedState.review_status === 'approved',
      sourceReviewed: approvedState.classification_source === 'agent_reviewed',
    }
    results.push({
      step: 'documents-governance-approve',
      ok: Object.values(approvedChecks).every(Boolean),
      details: { ...approvedChecks, approvedState },
      screenshot: await screenshot(documentPage, 'documents-governance-approved'),
    })

    results.push(await askChatAboutIndexedUpload(documentPage, fileName, token))
    await documentPage.goto(`${baseUrl}/admin/documents?doc=${processed.documentId}`, { waitUntil: 'networkidle' })
    await documentPage.waitForSelector(`text=${fileName}`, { timeout: 60_000 })

    await documentPage.getByRole('button', { name: /Reclasificar/i }).click()
    await documentPage.locator('aside select').nth(0).selectOption('legal')
    await documentPage.locator('aside select').nth(1).selectOption('executed')
    await documentPage.locator('aside input[placeholder^="project_id"]').fill('KLP')
    await waitForPatch(documentPage, processed.documentId, async () => {
      await documentPage.getByRole('button', { name: /Aplicar reclasificaci/i }).click()
    })
    await documentPage.waitForFunction(() =>
      /KLP/i.test(document.body.innerText) &&
      /legal/i.test(document.body.innerText) &&
      /agent_corrected/i.test(document.body.innerText),
      null,
      { timeout: 60_000 },
    )
    const reclassifiedState = await fetchGovernanceSnapshot(supabase, processed.documentId)
    const reclassifiedText = await documentPage.locator('body').innerText()
    const reclassifiedChecks = {
      visibleProject: /KLP/i.test(reclassifiedText),
      visibleDocType: /legal/i.test(reclassifiedText),
      visibleCorrectedSource: /agent_corrected/i.test(reclassifiedText),
      rowProject: reclassifiedState.project_id === 'KLP',
      rowDocType: reclassifiedState.doc_type === 'legal',
      rowAuthority: reclassifiedState.authority_tier === 'executed' && reclassifiedState.authority_score === 90,
      rowCorrectedSource: reclassifiedState.classification_source === 'agent_corrected',
    }
    results.push({
      step: 'documents-governance-reclassify',
      ok: Object.values(reclassifiedChecks).every(Boolean),
      details: { ...reclassifiedChecks, reclassifiedState },
      screenshot: await screenshot(documentPage, 'documents-governance-reclassified'),
    })

    await waitForPatch(documentPage, processed.documentId, async () => {
      await documentPage.getByRole('button', { name: /Retirar/i }).click()
    })
    await documentPage.waitForFunction(() => /Retirado/i.test(document.body.innerText), null, { timeout: 60_000 })
    const retiredState = await fetchGovernanceSnapshot(supabase, processed.documentId)
    await waitForPatch(documentPage, processed.documentId, async () => {
      await documentPage.getByRole('button', { name: /Restaurar/i }).click()
    })
    await documentPage.waitForFunction(() => /Retirar/i.test(document.body.innerText), null, { timeout: 60_000 })
    const restoredState = await fetchGovernanceSnapshot(supabase, processed.documentId)
    const restoredText = await documentPage.locator('aside').filter({ hasText: fileName }).innerText()
    const lifecycleChecks = {
      rowRetired: retiredState.status === 'retired',
      rowRestored: restoredState.status === 'indexed',
      visibleRestoredAction: /Retirar/i.test(restoredText),
      noRetiredBadge: !/Retirado/i.test(restoredText),
    }
    results.push({
      step: 'documents-governance-retire-restore',
      ok: Object.values(lifecycleChecks).every(Boolean),
      details: { ...lifecycleChecks, retiredState, restoredState },
      screenshot: await screenshot(documentPage, 'documents-governance-restored'),
    })

    const download = await documentPage.request.get(`${baseUrl}/api/knowledge/documents/${processed.documentId}/download`, { maxRedirects: 0 })
    results.push({
      step: 'documents-original-download-link',
      ok: download.status() === 302,
      details: { status: download.status(), location: download.headers().location ? 'present' : 'missing' },
    })

    failedCleanupState = {
      fileName: failedFileName,
      jobId: null,
      extraJobIds: new Set(),
      documentId: null,
      storagePaths: new Set(),
    }

    await documentPage.goto(`${baseUrl}/admin/ingest`, { waitUntil: 'networkidle' })
    await documentPage.waitForSelector('text=Ingesta documental')
    const failedSignResponsePromise = documentPage.waitForResponse((resp) =>
      resp.url().includes('/api/knowledge/upload/sign') && resp.request().method() === 'POST',
      { timeout: 120_000 },
    )
    const failedJobResponsePromise = documentPage.waitForResponse((resp) =>
      resp.url().includes('/api/knowledge/ingest/jobs') && resp.request().method() === 'POST',
      { timeout: 120_000 },
    )
    await documentPage.locator('input[type="file"]').setInputFiles(failedTempFile)
    await documentPage.locator('select').nth(0).selectOption('MAD')
    await documentPage.locator('select').nth(1).selectOption('funding')
    await documentPage.getByRole('button', { name: /Subir y encolar/i }).click()

    const failedSignPayload = await (await failedSignResponsePromise).json() as { path?: string }
    if (failedSignPayload.path) failedCleanupState.storagePaths.add(failedSignPayload.path)
    const failedJobPayload = await (await failedJobResponsePromise).json() as { job?: { id?: string; status?: string } }
    const failedJobId = failedJobPayload.job?.id
    if (!failedJobId) throw new Error('Failed upload did not return a job id')
    failedCleanupState.jobId = failedJobId
    await documentPage.waitForFunction(
      (file) => document.body.innerText.includes(file) && /encolado|cola/i.test(document.body.innerText),
      failedFileName,
      { timeout: 60_000 },
    )
    results.push({
      step: 'failed-ingest-ui-enqueues-upload',
      ok: true,
      details: { fileName: failedFileName, jobId: failedJobId, storagePath: failedSignPayload.path ?? null },
      screenshot: await screenshot(documentPage, 'failed-ingest-upload-enqueued'),
    })

    const failedProcessed = await processJobById(supabase, failedJobId, { allowError: true })
    if (failedProcessed.documentId) failedCleanupState.documentId = failedProcessed.documentId
    failedCleanupState.storagePaths.add(failedProcessed.storagePath)
    if (failedProcessed.status !== 'error' || !failedProcessed.documentId) {
      throw new Error(`Expected failed ingest, got ${failedProcessed.status}`)
    }
    const failedWorkerChecks = {
      statusIsError: failedProcessed.status === 'error',
      hasDocumentId: Boolean(failedProcessed.documentId),
      hasErrorReason: Boolean(failedProcessed.error && failedProcessed.error.length > 0),
    }
    results.push({
      step: 'failed-ingest-worker-records-error',
      ok: Object.values(failedWorkerChecks).every(Boolean),
      details: { ...failedWorkerChecks, failedProcessed },
    })

    await documentPage.goto(`${baseUrl}/admin/ingest`, { waitUntil: 'networkidle' })
    await documentPage.waitForFunction(
      (file) => document.body.innerText.includes(file) && /error/i.test(document.body.innerText),
      failedFileName,
      { timeout: 90_000 },
    )
    const failedJobPanelText = await documentPage.locator('body').innerText()
    const failedJobChecks = assertText(failedJobPanelText, [
      ['hasFile', new RegExp(failedFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))],
      ['hasErrorStatus', /error/i],
      ['hasFichaLink', /ficha/i],
    ])
    results.push({
      step: 'failed-ingest-ui-shows-error-link',
      ok: Object.values(failedJobChecks).every(Boolean),
      details: failedJobChecks,
      screenshot: await screenshot(documentPage, 'failed-ingest-job-error'),
    })

    await documentPage.locator(`a[href="/admin/documents?doc=${failedProcessed.documentId}"]`).first().click()
    await documentPage.waitForURL(/\/admin\/documents\?doc=/, { timeout: 60_000 })
    await documentPage.waitForSelector(`text=${failedFileName}`, { timeout: 60_000 })
    const failedPanelText = await documentPage.locator('aside').filter({ hasText: failedFileName }).innerText()
    const failedPanelChecks = assertText(failedPanelText, [
      ['hasFailedIngestNotice', /Ingesta fallida/i],
      ['hasRetryAction', /Reintentar ingesta/i],
      ['hasDeleteAction', /Borrar fallido/i],
      ['hasStoragePath', /uploads\//i],
    ])
    results.push({
      step: 'failed-document-panel-actions',
      ok: Object.values(failedPanelChecks).every(Boolean),
      details: failedPanelChecks,
      screenshot: await screenshot(documentPage, 'failed-document-panel'),
    })

    const retryResponsePromise = documentPage.waitForResponse((resp) =>
      resp.url().includes(`/api/knowledge/documents/${failedProcessed.documentId}/retry-ingest`) &&
      resp.request().method() === 'POST' &&
      resp.status() === 202,
      { timeout: 60_000 },
    )
    await documentPage.getByRole('button', { name: /Reintentar ingesta/i }).click()
    const retryPayload = await (await retryResponsePromise).json() as { job?: { id?: string }; alreadyQueued?: boolean }
    const retryJobId = retryPayload.job?.id
    if (retryJobId) failedCleanupState.extraJobIds.add(retryJobId)
    const retryJobDelete = retryJobId
      ? await supabase.from('knowledge_ingest_jobs').delete().eq('id', retryJobId)
      : null
    if (retryJobDelete?.error) throw new Error(`retry job cleanup failed: ${retryJobDelete.error.message}`)
    const retryChecks = {
      hasRetryJob: Boolean(retryJobId),
      newlyQueued: retryPayload.alreadyQueued === false,
      retryJobDeleted: !retryJobDelete?.error,
    }
    results.push({
      step: 'failed-document-retry-enqueues-job',
      ok: Object.values(retryChecks).every(Boolean),
      details: { ...retryChecks, retryJobId },
    })

    const deleteResponsePromise = documentPage.waitForResponse((resp) =>
      resp.url().includes(`/api/knowledge/documents/${failedProcessed.documentId}`) &&
      resp.request().method() === 'DELETE' &&
      resp.status() === 200,
      { timeout: 60_000 },
    )
    documentPage.once('dialog', async (dialog) => { await dialog.accept() })
    await documentPage.getByRole('button', { name: /Borrar fallido/i }).click()
    await deleteResponsePromise
    failedCleanupState.documentMayBeMissing = true
    const { data: deletedFailedDoc, error: deletedLookupErr } = await supabase
      .from('rag_documents')
      .select('id')
      .eq('id', failedProcessed.documentId)
      .maybeSingle()
    if (deletedLookupErr) throw new Error(`deleted failed document lookup failed: ${deletedLookupErr.message}`)
    const deleteChecks = {
      rowDeleted: deletedFailedDoc == null,
    }
    results.push({
      step: 'failed-document-delete-removes-row',
      ok: Object.values(deleteChecks).every(Boolean),
      details: deleteChecks,
      screenshot: await screenshot(documentPage, 'failed-document-deleted'),
    })
  } catch (err) {
    const bodyText = page ? await page.locator('body').innerText().catch(() => '') : ''
    const failureShot = page ? await screenshot(page, 'failure').catch(() => null) : null
    failure = {
      message: err instanceof Error ? err.message : String(err),
      url: page?.url(),
      bodyTail: bodyText.slice(-1500),
      screenshot: failureShot,
    }
  } finally {
    if (browser) await browser.close().catch(() => undefined)
    const cleanupTargets = [cleanupState, failedCleanupState].filter((state): state is CleanupState => Boolean(state))
    const cleanupResults = []
    for (const target of cleanupTargets) {
      cleanupResults.push(await cleanupUpload(supabase, target).catch((err) => ({
        fileName: target.fileName,
        error: errorMessage(err),
      })))
    }
    const cleanupOk = cleanupResults.every((item) => {
      const result = item as Record<string, unknown>
      return result.documentDeleted === true &&
        result.jobDeleted === true &&
        !result.documentDeleteError &&
        !result.jobDeleteError &&
        !result.storageRemoveError
    })
    conversationCleanup = await cleanupConversations(supabase, tempEmail).catch((err) => ({
      ok: false,
      error: errorMessage(err),
    }))
    cleanup = {
      ok: cleanupOk && conversationCleanup.ok === true,
      items: cleanupResults,
      conversations: conversationCleanup,
    }
    if (tempUserId) await supabase.auth.admin.deleteUser(tempUserId).catch(() => undefined)
    rmSync(tempFile, { force: true })
    rmSync(failedTempFile, { force: true })
    if (server) {
      server.kill('SIGTERM')
      await new Promise((resolveKill) => setTimeout(resolveKill, 500))
      if (!server.killed) server.kill('SIGKILL')
    }
  }

  const relevantConsoleMessages = consoleMessages
    .filter((line) => !/favicon|hydration/i.test(line))
    .slice(0, 12)

  const summary = {
    ok: !failure &&
      results.length === 16 &&
      results.every((result) => result.ok) &&
      failedRequests.length === 0 &&
      relevantConsoleMessages.length === 0 &&
      cleanup?.ok === true,
    baseUrl,
    results,
    failure,
    cleanup,
    tempUserCleaned: Boolean(tempUserId),
    failedRequests,
    consoleMessages: relevantConsoleMessages,
    artifactDir,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (!summary.ok) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
