import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { chromium } from 'playwright'
import { parseDocument } from '../../src/lib/rag/parse'
import { mistralOcrApiKey } from '../../src/lib/rag/ocr'

config({ path: '.env.local' })

const args = process.argv.slice(2)
const label = safeLabel(args.find((arg) => !arg.startsWith('--')) || 'manual')
const flags = new Set(args.filter((arg) => arg.startsWith('--')))
const requireConfigured = flags.has('--require')
const useLlama = flags.has('--use-llama')

type OcrSmokeStatus = 'pass' | 'skip' | 'fail'

type OcrSmokeResult = {
  label: string
  at: string
  status: OcrSmokeStatus
  enabled: boolean
  keyPresent: boolean
  llamaBypassed: boolean
  parser?: string
  ocrUsed?: boolean
  pageCount?: number | null
  ms?: number
  checks?: {
    codx: boolean
    ocr: boolean
    margin: boolean
  }
  preview?: string
  reason?: string
}

function safeLabel(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'manual'
}

function writeResult(result: OcrSmokeResult): void {
  const outDir = resolve(process.cwd(), 'scripts/eval/results')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `ocr-smoke-${label}.json`)
  writeFileSync(outPath, JSON.stringify(result, null, 2))
  console.log(`Wrote ${outPath}`)
}

function fail(result: OcrSmokeResult): never {
  writeResult({ ...result, status: 'fail' })
  process.exit(1)
}

async function makeOcrSmokePng(): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 520 }, deviceScaleFactor: 2 })
    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            html, body {
              margin: 0;
              width: 1200px;
              height: 520px;
              background: white;
              color: #050505;
              font-family: Arial, Helvetica, sans-serif;
            }
            main {
              padding: 72px 88px;
            }
            p {
              margin: 0 0 42px;
              font-size: 58px;
              line-height: 1.08;
              font-weight: 800;
              letter-spacing: 0;
            }
          </style>
        </head>
        <body>
          <main>
            <p>GEMSWELL OCR SMOKE TEST</p>
            <p>CODX OCR CHECK</p>
            <p>MARGIN 7.31 PERCENT</p>
          </main>
        </body>
      </html>
    `)
    return await page.screenshot({ type: 'png' })
  } finally {
    await browser.close()
  }
}

async function main(): Promise<void> {
  const enabled = process.env.RAG_OCR_ENABLED === 'true'
  const keyPresent = Boolean(mistralOcrApiKey())
  const base: OcrSmokeResult = {
    label,
    at: new Date().toISOString(),
    status: 'skip',
    enabled,
    keyPresent,
    llamaBypassed: !useLlama,
  }

  if (enabled && !keyPresent) {
    fail({ ...base, reason: 'RAG_OCR_ENABLED=true but no MISTRAL_API_KEY/MISTRAL_APIKEY_OCR is configured' })
  }

  if (!enabled) {
    const reason = keyPresent
      ? 'Mistral OCR key is present, but RAG_OCR_ENABLED is not true; OCR fallback is disabled'
      : 'Mistral OCR is not configured; smoke skipped'
    console.log(`::notice::${reason}`)
    writeResult({ ...base, reason })
    if (requireConfigured) process.exit(1)
    return
  }

  if (!useLlama) delete process.env.LLAMA_CLOUD_API_KEY
  const png = await makeOcrSmokePng()
  const started = Date.now()
  try {
    const parsed = await parseDocument('', png, 'codex-ocr-smoke.png', 'image/png')
    const content = parsed.content.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const compact = content.toUpperCase().replace(/[^A-Z0-9]+/g, '')
    const checks = {
      codx: compact.includes('CODX'),
      ocr: compact.includes('OCR'),
      margin: compact.includes('731') || /7\s*[.,]\s*31/.test(content),
    }
    const result: OcrSmokeResult = {
      ...base,
      status: checks.codx && checks.ocr && checks.margin && parsed.ocr_used === true ? 'pass' : 'fail',
      parser: parsed.parser,
      ocrUsed: parsed.ocr_used === true,
      pageCount: parsed.pageCount ?? null,
      ms: Date.now() - started,
      checks,
      preview: content.replace(/\s+/g, ' ').slice(0, 500),
    }
    writeResult(result)
    console.log(JSON.stringify(result, null, 2))
    if (result.status !== 'pass') process.exit(1)
  } catch (err) {
    fail({
      ...base,
      ms: Date.now() - started,
      reason: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
