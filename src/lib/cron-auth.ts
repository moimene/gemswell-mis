import { timingSafeEqual } from 'node:crypto'

/** Constant-time bearer check for internet-reachable cron endpoints. */
export function isAuthorizedCronRequest(authHeader: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !authHeader) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const got = Buffer.from(authHeader)

  return expected.length === got.length && timingSafeEqual(expected, got)
}
