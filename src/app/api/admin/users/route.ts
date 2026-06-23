import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAuthAdminClient, metadataForRole, serializeAdminUser } from '@/lib/admin-users'
import { requireUser } from '@/lib/supabase-server'

const RoleSchema = z.enum(['admin', 'user'])
const CreateUserSchema = z.object({
  email: z.string().trim().email('Email no válido'),
  password: z.string().trim().min(8, 'La contraseña debe tener al menos 8 caracteres').optional().or(z.literal('')),
  role: RoleSchema.default('admin'),
  confirmEmail: z.boolean().default(true),
})

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

function internalError(context: string, err: unknown) {
  console.error(`[admin/users] ${context}:`, err instanceof Error ? err.message : err)
  return NextResponse.json({ error: 'Error interno al gestionar usuarios.' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const page = Math.max(Number(request.nextUrl.searchParams.get('page') ?? '1') || 1, 1)
    const perPage = Math.min(Math.max(Number(request.nextUrl.searchParams.get('perPage') ?? '100') || 100, 1), 1000)
    const supabase = createAuthAdminClient()
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) return internalError('listUsers', error)

    return NextResponse.json({
      items: data.users.map((user) => serializeAdminUser(user, currentUser.id)),
      page,
      perPage,
      total: data.total ?? data.users.length,
      nextPage: data.nextPage ?? null,
      lastPage: data.lastPage ?? null,
    })
  } catch (err) {
    return internalError('GET', err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const parsed = CreateUserSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Solicitud no válida')

    const supabase = createAuthAdminClient()
    const password = parsed.data.password?.trim()
    const { data, error } = await supabase.auth.admin.createUser({
      email: parsed.data.email,
      ...(password ? { password } : {}),
      email_confirm: parsed.data.confirmEmail,
      app_metadata: metadataForRole({}, parsed.data.role),
    })
    if (error) return badRequest(error.message)
    if (!data.user) return internalError('createUser missing user', 'missing user')

    return NextResponse.json({ user: serializeAdminUser(data.user, currentUser.id) }, { status: 201 })
  } catch (err) {
    return internalError('POST', err)
  }
}
