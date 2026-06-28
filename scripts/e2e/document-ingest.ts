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
  documentId: string | null
  storagePaths: Set<string>
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

async function processJobById(sb: SupabaseClient, jobId: string): Promise<{ documentId: string; chunks: number; parser: string | null; storagePath: string }> {
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
    documentId: result.documentId,
    chunks: result.chunks ?? 0,
    parser: result.parser ?? null,
    storagePath: row.storage_path,
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

  if (state.jobId) {
    const deleted = await sb.from('knowledge_ingest_jobs').delete().eq('id', state.jobId)
    if (deleted.error) details.jobDeleteError = deleted.error.message
    else details.jobDeleted = true
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

  const cleanupState: CleanupState = { fileName, jobId: null, documentId: null, storagePaths: new Set() }
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

    const download = await page.request.get(`${baseUrl}/api/knowledge/documents/${processed.documentId}/download`, { maxRedirects: 0 })
    results.push({
      step: 'documents-original-download-link',
      ok: download.status() === 302,
      details: { status: download.status(), location: download.headers().location ? 'present' : 'missing' },
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
    cleanup = await cleanupUpload(supabase, cleanupState).catch((err) => ({ error: errorMessage(err) }))
    if (tempUserId) await supabase.auth.admin.deleteUser(tempUserId).catch(() => undefined)
    rmSync(tempFile, { force: true })
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
      results.length === 6 &&
      results.every((result) => result.ok) &&
      failedRequests.length === 0 &&
      relevantConsoleMessages.length === 0 &&
      cleanup?.documentDeleted === true &&
      cleanup?.jobDeleted === true,
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
