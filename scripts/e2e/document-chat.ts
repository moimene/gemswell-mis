import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { chromium, type Browser, type Page } from 'playwright'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.local') })

type StepResult = {
  step: string
  ok: boolean
  details?: Record<string, unknown>
  screenshot?: string
}

type SmartSearchScenario = {
  step: string
  query: string
  project: string
  docType: string
  expectedDocId: string
  expectedTitle: RegExp
  checks: Array<[string, RegExp]>
  screenshot: string
}

type ChatScenario = {
  step: string
  question: string
  checks: Array<[string, RegExp]>
  screenshot: string
}

type ChatSourceLinkScenario = {
  step: string
  expectedDocId: string
  expectedTitle: RegExp
  checks: Array<[string, RegExp]>
  screenshot: string
}

const requestedPort = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : null
let baseUrl = process.env.E2E_BASE_URL || ''
const startServer = process.env.E2E_START_SERVER !== 'false' && !process.env.E2E_BASE_URL
const artifactDir = process.env.E2E_ARTIFACT_DIR || join(tmpdir(), 'gemswell-mis-e2e-doc-chat')

const smartSearchScenarios: SmartSearchScenario[] = [
  {
    step: 'dms-smart-search-santander-bbva',
    query: 'coste financiacion bancaria MPS Santander BBVA',
    project: 'MAD',
    docType: 'funding',
    expectedDocId: 'becaff10-41f7-4175-950d-d70e9a1d3b6b',
    expectedTitle: /4140-7692-5542/,
    checks: [
      ['hasContract', /4140-7692-5542/],
      ['hasBanksOrReason', /Santander|BBVA|financiador|financiadoras/i],
      ['hasGraphBadge', /GRAFO/i],
      ['hasRerankOrModel', /RERANK|MODELO/i],
    ],
    screenshot: 'dms-smart-santander-bbva',
  },
  {
    step: 'dms-smart-search-buenavista',
    query: 'condiciones financiacion Buenavista Madrid credito participativo',
    project: 'MAD',
    docType: 'funding',
    expectedDocId: '502705bf-da6d-44bd-9871-38b1e1a8ab73',
    expectedTitle: /4148-6073-6102|Buenavista/i,
    checks: [
      ['hasBuenavista', /Buenavista/i],
      ['hasParticipativeCredit', /participativo|participative|cr[eé]dito/i],
      ['hasGraphBadge', /GRAFO/i],
      ['hasRerankOrModel', /RERANK|MODELO/i],
    ],
    screenshot: 'dms-smart-buenavista',
  },
]

const chatScenarios: ChatScenario[] = [
  {
    step: 'chat-answer-santander-bbva',
    question: 'cual es para mps el coste de la financiacion bancaria del prestamo santander y bbva?',
    checks: [
      ['hasFinancialTerms', /EURIBOR|Margen|4[,\\.]00/i],
      ['hasBanks', /Santander|BBVA/i],
      ['hasSourceTitle', /4140-7692-5542|Contrato de financiaci/i],
    ],
    screenshot: 'chat-santander-bbva',
  },
  {
    step: 'chat-answer-buenavista',
    question: 'Condiciones de la financiación de Buenavista para el proyecto de Madrid',
    checks: [
      ['hasBuenavista', /Buenavista/i],
      ['hasParticipativeCredit', /participativo|cr[eé]dito/i],
      ['hasAmount', /15[.,]657[.,]498[.,]18/i],
      ['hasSourceTitle', /4148-6073-6102|Contrato de Cr[eé]dito Participativo/i],
    ],
    screenshot: 'chat-buenavista',
  },
]

const chatSourceLinkScenarios: ChatSourceLinkScenario[] = [
  {
    step: 'chat-source-link-opens-santander-bbva-document',
    expectedDocId: 'becaff10-41f7-4175-950d-d70e9a1d3b6b',
    expectedTitle: /4140-7692-5542/,
    checks: [
      ['hasLibrary', /Biblioteca documental/i],
      ['hasContract', /4140-7692-5542/],
      ['hasDocumentPanel', /MARKDOWN|FRAGMENTOS|HISTORIAL/i],
      ['hasFundingMeta', /funding|financiaci/i],
    ],
    screenshot: 'chat-source-link-santander-bbva-document',
  },
  {
    step: 'chat-history-source-link-opens-santander-bbva-document',
    expectedDocId: 'becaff10-41f7-4175-950d-d70e9a1d3b6b',
    expectedTitle: /4140-7692-5542/,
    checks: [
      ['hasLibrary', /Biblioteca documental/i],
      ['hasContract', /4140-7692-5542/],
      ['hasDocumentPanel', /MARKDOWN|FRAGMENTOS|HISTORIAL/i],
      ['hasFundingMeta', /funding|financiaci/i],
    ],
    screenshot: 'chat-history-source-link-santander-bbva-document',
  },
  {
    step: 'chat-source-link-opens-buenavista-document',
    expectedDocId: '502705bf-da6d-44bd-9871-38b1e1a8ab73',
    expectedTitle: /4148-6073-6102|Buenavista/i,
    checks: [
      ['hasLibrary', /Biblioteca documental/i],
      ['hasContract', /4148-6073-6102|Buenavista/i],
      ['hasDocumentPanel', /MARKDOWN|FRAGMENTOS|HISTORIAL/i],
      ['hasFundingMeta', /funding|financiaci/i],
    ],
    screenshot: 'chat-source-link-buenavista-document',
  },
]

function maskEmail(email: string): string {
  return email.replace(/^(.).+(@.*)$/, '$1***$2')
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
    detached: process.platform !== 'win32',
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

function killServerProcess(child: ChildProcess, signal: NodeJS.Signals) {
  if (process.platform !== 'win32' && child.pid) {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall back to the npm process if the process group has already exited.
    }
  }
  try {
    child.kill(signal)
  } catch {
    // Process already gone.
  }
}

async function stopNextServer(child: ChildProcess): Promise<void> {
  child.stdout?.destroy()
  child.stderr?.destroy()
  if (child.exitCode !== null || child.signalCode !== null) return

  const exited = new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()))
  killServerProcess(child, 'SIGTERM')
  await Promise.race([exited, sleep(1_500)])

  if (child.exitCode === null && child.signalCode === null) {
    killServerProcess(child, 'SIGKILL')
    await Promise.race([exited, sleep(500)])
  }
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

function assertText(text: string, checks: Array<[string, RegExp]>): Record<string, boolean> {
  return Object.fromEntries(checks.map(([name, re]) => [name, re.test(text)]))
}

function attachProgressLogger(results: StepResult[], label: string): void {
  const push = results.push.bind(results)
  results.push = (...items: StepResult[]) => {
    for (const item of items) {
      console.log(JSON.stringify({
        e2e: label,
        step: item.step,
        ok: item.ok,
        details: item.details ?? null,
        screenshot: item.screenshot ?? null,
      }))
    }
    return push(...items)
  }
}

async function ensureSmartSearchMode(page: Page) {
  if (!page.url().startsWith(`${baseUrl}/admin/documents`)) {
    await page.goto(`${baseUrl}/admin/documents`, { waitUntil: 'networkidle' })
  }
  await page.waitForSelector('text=Biblioteca documental')
  const smartButton = page.getByRole('button', { name: /Inteligente/i })
  await smartButton.click()
}

async function runSmartSearch(page: Page, scenario: SmartSearchScenario): Promise<StepResult> {
  await ensureSmartSearchMode(page)
  await page.locator('select').nth(0).selectOption('')
  await page.locator('select').nth(1).selectOption(scenario.docType)
  await page.locator('select').nth(2).selectOption(scenario.project)
  const responsePromise = page.waitForResponse((resp) =>
    resp.url().includes('/api/knowledge/documents/intelligent-search') && resp.status() === 200,
    { timeout: 180_000 },
  )
  await page.getByPlaceholder(/Buscar contenido/i).fill(scenario.query)
  const response = await responsePromise
  const payload = await response.json() as {
    items?: Array<{ id?: string; title?: string | null }>
    graphUsed?: boolean
    modelRerankUsed?: boolean
    modelUsed?: boolean
  }
  await page.waitForFunction(
    (pattern) => new RegExp(pattern, 'i').test(document.body.innerText),
    scenario.expectedTitle.source,
    { timeout: 180_000 },
  )
  const bodyText = await page.locator('body').innerText()
  const visibleChecks = assertText(bodyText, scenario.checks)
  const apiChecks = {
    topExpectedDoc: payload.items?.[0]?.id === scenario.expectedDocId,
    graphUsed: payload.graphUsed === true,
    rerankOrModelUsed: payload.modelRerankUsed === true || payload.modelUsed === true,
  }
  const details = { ...visibleChecks, ...apiChecks }
  return {
    step: scenario.step,
    ok: Object.values(details).every(Boolean),
    details,
    screenshot: await screenshot(page, scenario.screenshot),
  }
}

async function clickFirstSmartSnippet(page: Page): Promise<StepResult> {
  const snippet = page.locator('button').filter({ hasText: /^#\d+/ }).first()
  await snippet.click()
  await page.waitForURL(/doc=.*chunk=/, { timeout: 60_000 })
  await page.waitForSelector('text=FRAGMENTOS', { timeout: 60_000 })
  const text = await page.locator('body').innerText()
  const details = assertText(text, [
    ['hasDocumentPanel', /MARKDOWN|FRAGMENTOS|HISTORIAL/i],
    ['hasChunkEvidence', /#\d+|Fragmentos/i],
  ])
  return {
    step: 'dms-smart-snippet-deeplink',
    ok: Object.values(details).every(Boolean),
    details,
    screenshot: await screenshot(page, 'dms-smart-snippet-deeplink'),
  }
}

async function sendChatQuestion(page: Page, scenario: ChatScenario): Promise<StepResult> {
  await page.goto(`${baseUrl}/chat`, { waitUntil: 'networkidle' })
  await page.waitForSelector('textarea')
  const newConversation = page.getByRole('button', { name: /Nueva conversación/i })
  if (await newConversation.count()) await newConversation.click()
  await page.locator('textarea').fill(scenario.question)
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
    scenario.checks.map(([, re]) => re.source),
    { timeout: 240_000 },
  )
  const text = await page.locator('body').innerText()
  const details = assertText(text, scenario.checks)
  return {
    step: scenario.step,
    ok: Object.values(details).every(Boolean),
    details,
    screenshot: await screenshot(page, scenario.screenshot),
  }
}

async function openChatSourceDeepLink(page: Page, scenario: ChatSourceLinkScenario): Promise<StepResult> {
  const sourceLink = page
    .locator('a[href*="/admin/documents?doc="]')
    .filter({ hasText: scenario.expectedTitle })
    .first()
  await sourceLink.waitFor({ state: 'visible', timeout: 60_000 })

  const popupPromise = page.context().waitForEvent('page', { timeout: 60_000 })
  await sourceLink.click()
  const docPage = await popupPromise

  try {
    await docPage.waitForURL(/\/admin\/documents\?doc=/, { timeout: 60_000 })
    await docPage.waitForSelector('text=Biblioteca documental', { timeout: 60_000 })
    await docPage.waitForFunction(
      (pattern) => new RegExp(pattern, 'i').test(document.body.innerText),
      scenario.expectedTitle.source,
      { timeout: 60_000 },
    )
    const text = await docPage.locator('body').innerText()
    const visibleChecks = assertText(text, scenario.checks)
    const details = {
      ...visibleChecks,
      urlHasExpectedDocId: docPage.url().includes(`doc=${scenario.expectedDocId}`),
    }
    return {
      step: scenario.step,
      ok: Object.values(details).every(Boolean),
      details,
      screenshot: await screenshot(docPage, scenario.screenshot),
    }
  } finally {
    await docPage.close().catch(() => undefined)
  }
}

async function restoreChatHistoryAndOpenSourceDeepLink(
  page: Page,
  chatScenario: ChatScenario,
  linkScenario: ChatSourceLinkScenario,
): Promise<StepResult> {
  const conversationResponse = page.waitForResponse((resp) =>
    resp.url().includes('/api/chat/conversations/') && resp.status() === 200,
    { timeout: 60_000 },
  )
  await page.reload({ waitUntil: 'networkidle' })
  await conversationResponse
  await page.waitForSelector('textarea', { timeout: 60_000 })
  await page.waitForFunction(
    (patterns) => {
      const text = document.body.innerText
      return (patterns as string[]).every((pattern) => new RegExp(pattern, 'i').test(text))
    },
    chatScenario.checks.map(([, re]) => re.source),
    { timeout: 90_000 },
  )

  const restoredSourceLink = page
    .locator('a[href*="/admin/documents?doc="]')
    .filter({ hasText: linkScenario.expectedTitle })
    .first()
  await restoredSourceLink.waitFor({ state: 'visible', timeout: 60_000 })

  const linkResult = await openChatSourceDeepLink(page, linkScenario)
  return {
    ...linkResult,
    details: {
      ...(linkResult.details ?? {}),
      restoredAnswer: true,
      restoredSourceLink: true,
    },
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const tempEmail = `codex-e2e-${Date.now()}@gemswell.local`
  const tempPassword = `CodexE2E-${randomBytes(12).toString('hex')}!aA1`
  let tempUserId: string | null = null
  let server: ChildProcess | null = null
  let browser: Browser | null = null
  let page: Page | null = null
  const results: StepResult[] = []
  attachProgressLogger(results, 'document-chat')
  const consoleMessages: string[] = []
  const failedRequests: string[] = []
  let failure: Record<string, unknown> | null = null

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

    await page.goto(`${baseUrl}/login?redirect=/admin/documents`, { waitUntil: 'networkidle' })
    await page.waitForSelector('#login-email')
    await page.fill('#login-email', tempEmail)
    await page.fill('#login-password', tempPassword)
    await page.getByRole('button', { name: /^Entrar$/ }).click()
    await page.waitForURL(/\/admin\/documents/)
    await page.waitForSelector('text=Biblioteca documental')
    results.push({ step: 'login-form-temp-admin', ok: true, details: { email: maskEmail(tempEmail) } })

    results.push(await runSmartSearch(page, smartSearchScenarios[0]))
    results.push(await clickFirstSmartSnippet(page))
    results.push(await runSmartSearch(page, smartSearchScenarios[1]))

    for (const scenario of chatScenarios) {
      results.push(await sendChatQuestion(page, scenario))
      if (scenario.step === 'chat-answer-santander-bbva') {
        results.push(await openChatSourceDeepLink(page, chatSourceLinkScenarios[0]))
        results.push(await restoreChatHistoryAndOpenSourceDeepLink(page, scenario, chatSourceLinkScenarios[1]))
      } else if (scenario.step === 'chat-answer-buenavista') {
        results.push(await openChatSourceDeepLink(page, chatSourceLinkScenarios[2]))
      }
    }
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
    if (tempUserId) await supabase.auth.admin.deleteUser(tempUserId).catch(() => undefined)
    if (server) {
      await stopNextServer(server)
    }
  }

  const relevantConsoleMessages = consoleMessages
    .filter((line) => !/favicon|hydration/i.test(line))
    .slice(0, 12)

  const summary = {
    ok: !failure &&
      results.length === 2 + smartSearchScenarios.length + chatScenarios.length + chatSourceLinkScenarios.length &&
      results.every((result) => result.ok) &&
      failedRequests.length === 0 &&
      relevantConsoleMessages.length === 0,
    baseUrl,
    results,
    failure,
    tempUserCleaned: Boolean(tempUserId),
    failedRequests,
    consoleMessages: relevantConsoleMessages,
    artifactDir,
  }
  console.log(JSON.stringify(summary, null, 2))
  process.exit(summary.ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
