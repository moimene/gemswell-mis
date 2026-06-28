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

const requestedPort = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : null
let baseUrl = process.env.E2E_BASE_URL || ''
const startServer = process.env.E2E_START_SERVER !== 'false' && !process.env.E2E_BASE_URL
const artifactDir = process.env.E2E_ARTIFACT_DIR || join(tmpdir(), 'gemswell-mis-e2e-doc-chat')

function maskEmail(email: string): string {
  return email.replace(/^(.).+(@.*)$/, '$1***$2')
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.status < 500) return
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

function assertText(text: string, checks: Array<[string, RegExp]>): Record<string, boolean> {
  return Object.fromEntries(checks.map(([name, re]) => [name, re.test(text)]))
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

    await page.getByRole('button', { name: /Inteligente/i }).click()
    await page.locator('select').nth(1).selectOption('funding')
    await page.locator('select').nth(2).selectOption('MAD')
    const smartSearch = page.waitForResponse((resp) =>
      resp.url().includes('/api/knowledge/documents/intelligent-search') && resp.status() === 200,
      { timeout: 180_000 },
    )
    await page.getByPlaceholder(/Buscar contenido/i).fill('coste financiacion bancaria MPS Santander BBVA')
    await smartSearch
    await page.waitForSelector('text=4140-7692-5542', { timeout: 180_000 })
    const dmsText = await page.locator('body').innerText()
    const dmsChecks = assertText(dmsText, [
      ['hasContract', /4140-7692-5542/],
      ['hasBanksOrReason', /Santander|BBVA|financiador|financiadoras/i],
      ['hasGraphBadge', /GRAFO/i],
      ['hasRerankOrModel', /RERANK|MODELO/i],
    ])
    results.push({
      step: 'dms-smart-search',
      ok: Object.values(dmsChecks).every(Boolean),
      details: dmsChecks,
      screenshot: await screenshot(page, 'dms-smart-santander-bbva'),
    })

    await page.goto(`${baseUrl}/chat`, { waitUntil: 'networkidle' })
    await page.waitForSelector('textarea')
    await page.locator('textarea').fill('cual es para mps el coste de la financiacion bancaria del prestamo santander y bbva?')
    await page.locator('textarea').evaluate((el) => {
      const wrapper = el.closest('.flex.items-end')
      const button = wrapper?.querySelector('button') as HTMLButtonElement | null
      if (!button) throw new Error('send button not found')
      button.click()
    })
    await page.waitForFunction(() => {
      const text = document.body.innerText
      return /EURIBOR|Margen|4[,\\.]00|Santander|BBVA/i.test(text) &&
        /4140-7692-5542|Contrato de financiaci/i.test(text)
    }, null, { timeout: 240_000 })
    const chatText = await page.locator('body').innerText()
    const chatChecks = assertText(chatText, [
      ['hasFinancialTerms', /EURIBOR|Margen|4[,\\.]00/i],
      ['hasBanks', /Santander|BBVA/i],
      ['hasSourceTitle', /4140-7692-5542|Contrato de financiaci/i],
    ])
    results.push({
      step: 'chat-answer',
      ok: Object.values(chatChecks).every(Boolean),
      details: chatChecks,
      screenshot: await screenshot(page, 'chat-santander-bbva'),
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
    if (tempUserId) await supabase.auth.admin.deleteUser(tempUserId).catch(() => undefined)
    if (server) {
      server.kill('SIGTERM')
      await new Promise((resolveKill) => setTimeout(resolveKill, 500))
      if (!server.killed) server.kill('SIGKILL')
    }
  }

  const summary = {
    ok: !failure && results.length === 3 && results.every((result) => result.ok) && failedRequests.length === 0,
    baseUrl,
    results,
    failure,
    tempUserCleaned: Boolean(tempUserId),
    failedRequests,
    consoleMessages: consoleMessages
      .filter((line) => !/favicon|hydration/i.test(line))
      .slice(0, 12),
    artifactDir,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (!summary.ok) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
