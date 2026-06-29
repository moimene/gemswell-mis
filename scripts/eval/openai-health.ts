import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { config } from 'dotenv'
config({ path: '.env.local' })
import OpenAI from 'openai'
import { isOpenAIQuotaError, sanitizeOpenAIError } from '../../src/lib/openai-error'

type Options = {
  label: string
  outPath: string | null
}

function parseArgs(argv = process.argv.slice(2)): Options {
  let label: string | null = null
  let outPath: string | null = null

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--out') {
      outPath = argv[index + 1] ?? null
      index++
    } else if (arg.startsWith('--out=')) {
      outPath = arg.slice('--out='.length)
    } else if (!arg.startsWith('--') && !label) {
      label = arg
    }
  }

  return {
    label: label || new Date().toISOString().replace(/[:.]/g, '-'),
    outPath: outPath ? resolve(outPath) : null,
  }
}

const options = parseArgs()
const label = options.label
const model = process.env.OPENAI_CHAT_MODEL || 'gpt-5.5'
const outDir = resolve('scripts/eval/results')
mkdirSync(outDir, { recursive: true })
const outPath = options.outPath ?? resolve(outDir, `openai-health-${label}.json`)
mkdirSync(dirname(outPath), { recursive: true })

type HealthResult = {
  label: string
  at: string
  ok: boolean
  model: string
  failure?: {
    status?: number
    code?: string
    type?: string
    message: string
    class: 'missing_key' | 'quota_or_billing' | 'other_openai_error'
    nextAction: string
  }
}

function write(result: HealthResult) {
  writeFileSync(outPath, JSON.stringify(result, null, 2))
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    const result: HealthResult = {
      label,
      at: new Date().toISOString(),
      ok: false,
      model,
      failure: {
        class: 'missing_key',
        message: 'OPENAI_API_KEY is not configured.',
        nextAction: 'Configure OPENAI_API_KEY before running live RAG or production E2E gates.',
      },
    }
    write(result)
    console.error(`[openai-health] missing OPENAI_API_KEY; wrote ${outPath}`)
    process.exit(1)
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const response = await openai.responses.create({
      model,
      store: false,
      max_output_tokens: 16,
      instructions: 'Health check. Reply with exactly OK.',
      input: 'Return OK.',
    })
    const ok = /ok/i.test(response.output_text ?? '')
    const result: HealthResult = { label, at: new Date().toISOString(), ok, model }
    write(result)
    if (!ok) {
      console.error(`[openai-health] model responded unexpectedly; wrote ${outPath}`)
      process.exit(1)
    }
    console.log(`[openai-health] ok model=${model}; wrote ${outPath}`)
  } catch (err) {
    const sanitized = sanitizeOpenAIError(err)
    const quota = isOpenAIQuotaError(err)
    const result: HealthResult = {
      label,
      at: new Date().toISOString(),
      ok: false,
      model,
      failure: {
        ...sanitized,
        class: quota ? 'quota_or_billing' : 'other_openai_error',
        nextAction: quota
          ? 'OpenAI API quota or billing is exhausted. Check https://platform.openai.com/settings/organization/billing and https://platform.openai.com/settings/organization/limits.'
          : 'Inspect the sanitized OpenAI status/code/message and fix model access, project limits, or API availability before release.',
      },
    }
    write(result)
    console.error(`[openai-health] failed class=${quota ? 'quota_or_billing' : 'other_openai_error'} status=${sanitized.status ?? 'n/a'} code=${sanitized.code ?? 'n/a'} message=${sanitized.message}; wrote ${outPath}`)
    process.exit(1)
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  const result: HealthResult = {
    label,
    at: new Date().toISOString(),
    ok: false,
    model,
    failure: {
      class: 'other_openai_error',
      message,
      nextAction: 'Unexpected health-check failure. Inspect runtime logs before release.',
    },
  }
  write(result)
  console.error(`[openai-health] unexpected failure: ${message}; wrote ${outPath}`)
  process.exit(1)
})
