import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAuthAdminClient, metadataForRole, serializeAdminUser } from '@/lib/admin-users'
import { requireUser } from '@/lib/supabase-server'

const RoleSchema = z.enum(['admin', 'user'])
const UpdateUserSchema = z.object({
  email: z.string().trim().email('Email no válido').optional().or(z.literal('')),
  password: z.string().trim().min(8, 'La contraseña debe tener al menos 8 caracteres').optional().or(z.literal('')),
  role: RoleSchema.optional(),
  confirmEmail: z.boolean().optional(),
})

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

function internalError(context: string, err: unknown) {
  console.error(`[admin/users/:id] ${context}:`, err instanceof Error ? err.message : err)
  return NextResponse.json({ error: 'Error interno al gestionar usuarios.' }, { status: 500 })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = await params

    const parsed = UpdateUserSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Solicitud no válida')
    if (id === currentUser.id && parsed.data.role && parsed.data.role !== 'admin') {
      return badRequest('No puedes quitarte tu propio acceso de administrador.')
    }

    const supabase = createAuthAdminClient()
    const current = await supabase.auth.admin.getUserById(id)
    if (current.error) return badRequest(current.error.message)
    if (!current.data.user) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })

    const attributes: {
      email?: string
      password?: string
      email_confirm?: boolean
      app_metadata?: Record<string, unknown>
    } = {}
    if (parsed.data.email?.trim()) attributes.email = parsed.data.email.trim()
    if (parsed.data.password?.trim()) attributes.password = parsed.data.password.trim()
    if (typeof parsed.data.confirmEmail === 'boolean') attributes.email_confirm = parsed.data.confirmEmail
    if (parsed.data.role) attributes.app_metadata = metadataForRole(current.data.user.app_metadata, parsed.data.role)

    if (Object.keys(attributes).length === 0) return badRequest('No hay cambios para aplicar.')

    const { data, error } = await supabase.auth.admin.updateUserById(id, attributes)
    if (error) return badRequest(error.message)
    if (!data.user) return internalError('updateUserById missing user', 'missing user')

    return NextResponse.json({ user: serializeAdminUser(data.user, currentUser.id) })
  } catch (err) {
    return internalError('PATCH', err)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = await params
    if (id === currentUser.id) return badRequest('No puedes borrar tu propio usuario administrador.')

    const supabase = createAuthAdminClient()
    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) return badRequest(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return internalError('DELETE', err)
  }
}
