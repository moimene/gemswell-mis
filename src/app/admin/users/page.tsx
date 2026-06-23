'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CheckCircle2, Eye, EyeOff, KeyRound, Pencil, RefreshCw, Search,
  ShieldCheck, Trash2, UserPlus, XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/terminal'
import { apiJson } from '@/lib/api-fetch'
import { cn } from '@/lib/utils'

type AccessRole = 'admin' | 'user'
type AdminUserRow = {
  id: string
  email: string
  createdAt: string
  updatedAt: string | null
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  confirmed: boolean
  role: AccessRole
  isAdmin: boolean
  isCurrentUser: boolean
  providers: string[]
  hasCredentials: boolean
  bannedUntil: string | null
}
type UsersResponse = { items: AdminUserRow[]; total: number }

const EMPTY_FORM = { email: '', password: '', role: 'admin' as AccessRole, confirmEmail: true }

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function RoleBadge({ role }: { role: AccessRole }) {
  return role === 'admin' ? (
    <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-700">
      <ShieldCheck className="h-3 w-3" /> admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
      <XCircle className="h-3 w-3" /> sin acceso
    </span>
  )
}

function CredentialBadge({ user }: { user: AdminUserRow }) {
  return user.hasCredentials ? (
    <span className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-sky-700">
      <KeyRound className="h-3 w-3" /> {user.providers.join(', ') || 'email'}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-700">
      <XCircle className="h-3 w-3" /> sin credencial
    </span>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [showEditPassword, setShowEditPassword] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiJson<UsersResponse>('/api/admin/users?perPage=1000')
      setUsers(data.items ?? [])
    } catch (err) {
      if ((err as { status?: number }).status !== 401) toast.error(err instanceof Error ? err.message : 'No se pudieron cargar usuarios.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return users
    return users.filter((user) =>
      user.email.toLowerCase().includes(needle) ||
      user.id.toLowerCase().includes(needle) ||
      user.role.includes(needle)
    )
  }, [query, users])

  const adminCount = users.filter((user) => user.isAdmin).length
  const credentialCount = users.filter((user) => user.hasCredentials).length

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setBusyId('create')
    try {
      const created = await apiJson<{ user: AdminUserRow }>('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      setUsers((prev) => [created.user, ...prev.filter((user) => user.id !== created.user.id)])
      setCreateForm(EMPTY_FORM)
      toast.success('Usuario creado.')
    } catch (err) {
      if ((err as { status?: number }).status !== 401) toast.error(err instanceof Error ? err.message : 'No se pudo crear el usuario.')
    } finally {
      setBusyId(null)
    }
  }

  function startEdit(user: AdminUserRow) {
    setEditingId(user.id)
    setEditForm({ email: user.email, password: '', role: user.role, confirmEmail: user.confirmed })
    setShowEditPassword(false)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setBusyId(editingId)
    try {
      const updated = await apiJson<{ user: AdminUserRow }>(`/api/admin/users/${editingId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      setUsers((prev) => prev.map((user) => user.id === updated.user.id ? updated.user : user))
      setEditingId(null)
      toast.success('Usuario actualizado.')
    } catch (err) {
      if ((err as { status?: number }).status !== 401) toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.')
    } finally {
      setBusyId(null)
    }
  }

  async function removeUser(user: AdminUserRow) {
    if (user.isCurrentUser) return
    if (!confirm(`¿Dar de baja y borrar el usuario ${user.email}?`)) return
    setBusyId(user.id)
    try {
      await apiJson(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      setUsers((prev) => prev.filter((row) => row.id !== user.id))
      toast.success('Usuario dado de baja.')
    } catch (err) {
      if ((err as { status?: number }).status !== 401) toast.error(err instanceof Error ? err.message : 'No se pudo borrar el usuario.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Gemswell Ventures · MIS · Administración"
        title="Usuarios y credenciales"
        subtitle="Alta, baja y modificación de usuarios con acceso al MIS."
        right={
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Actualizar
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Usuarios Auth</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Administradores</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{adminCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">Con credencial</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{credentialCount}</p>
        </div>
      </div>

      <form onSubmit={createUser} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-slate-500" />
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Alta de usuario</h2>
        </div>
        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,240px)_160px_140px_auto]">
          <input
            type="email"
            required
            value={createForm.email}
            onChange={(e) => setCreateForm((form) => ({ ...form, email: e.target.value }))}
            placeholder="usuario@empresa.com"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          <div className="flex rounded-md border border-slate-200">
            <input
              type={showCreatePassword ? 'text' : 'password'}
              value={createForm.password}
              onChange={(e) => setCreateForm((form) => ({ ...form, password: e.target.value }))}
              placeholder="Contraseña opcional"
              className="min-w-0 flex-1 rounded-l-md px-3 py-2 text-sm outline-none"
            />
            <button type="button" onClick={() => setShowCreatePassword((show) => !show)} className="px-2 text-slate-500 hover:text-slate-800" title={showCreatePassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <select value={createForm.role} onChange={(e) => setCreateForm((form) => ({ ...form, role: e.target.value as AccessRole }))} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
            <option value="admin">Administrador</option>
            <option value="user">Sin acceso MIS</option>
          </select>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <input type="checkbox" checked={createForm.confirmEmail} onChange={(e) => setCreateForm((form) => ({ ...form, confirmEmail: e.target.checked }))} />
            Confirmar email
          </label>
          <button disabled={busyId === 'create'} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            <UserPlus className="h-4 w-4" /> Crear
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-500">Usuarios actuales</h2>
            <p className="mt-1 text-sm text-slate-500">Supabase no expone contraseñas; esta vista muestra cuentas, rol, credencial y último acceso.</p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-slate-200 px-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar usuario…" className="py-1.5 text-sm outline-none placeholder:text-slate-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="px-3 py-2.5">Usuario</th>
                <th className="px-3 py-2.5">Rol</th>
                <th className="px-3 py-2.5">Credencial</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Último acceso</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const isEditing = editingId === user.id
                return (
                  <tr key={user.id} className={cn('border-b border-slate-50 odd:bg-slate-50/30', user.isCurrentUser && 'bg-sky-50/60')}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">
                        {user.email || 'Sin email'}
                        {user.isCurrentUser && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-sky-700">tú</span>}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">{user.id}</div>
                    </td>
                    <td className="px-3 py-3">{isEditing ? (
                      <select
                        value={editForm.role}
                        disabled={user.isCurrentUser}
                        onChange={(e) => setEditForm((form) => ({ ...form, role: e.target.value as AccessRole }))}
                        className="rounded-md border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-100"
                      >
                        <option value="admin">Administrador</option>
                        <option value="user">Sin acceso MIS</option>
                      </select>
                    ) : <RoleBadge role={user.role} />}</td>
                    <td className="px-3 py-3"><CredentialBadge user={user} /></td>
                    <td className="px-3 py-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input value={editForm.email} onChange={(e) => setEditForm((form) => ({ ...form, email: e.target.value }))} className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs" />
                          <label className="flex items-center gap-1.5 text-xs text-slate-500">
                            <input type="checkbox" checked={editForm.confirmEmail} onChange={(e) => setEditForm((form) => ({ ...form, confirmEmail: e.target.checked }))} />
                            Confirmado
                          </label>
                        </div>
                      ) : (
                        <span className={cn('inline-flex items-center gap-1 text-xs', user.confirmed ? 'text-emerald-700' : 'text-amber-700')}>
                          {user.confirmed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          {user.confirmed ? `Confirmado ${formatDate(user.emailConfirmedAt)}` : 'Pendiente'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">{formatDate(user.lastSignInAt)}</td>
                    <td className="px-3 py-3 text-right">
                      {isEditing ? (
                        <form onSubmit={saveEdit} className="ml-auto flex max-w-[420px] flex-wrap justify-end gap-2">
                          <div className="flex min-w-[180px] rounded-md border border-slate-200">
                            <input
                              type={showEditPassword ? 'text' : 'password'}
                              value={editForm.password}
                              onChange={(e) => setEditForm((form) => ({ ...form, password: e.target.value }))}
                              placeholder="Nueva contraseña"
                              className="min-w-0 flex-1 rounded-l-md px-2 py-1.5 text-xs outline-none"
                            />
                            <button type="button" onClick={() => setShowEditPassword((show) => !show)} className="px-2 text-slate-500 hover:text-slate-800" title={showEditPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                              {showEditPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <button disabled={busyId === user.id} className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">Guardar</button>
                          <button type="button" onClick={() => setEditingId(null)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Cancelar</button>
                        </form>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => startEdit(user)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50" title="Editar usuario">
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button
                            onClick={() => removeUser(user)}
                            disabled={user.isCurrentUser || busyId === user.id}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                            title={user.isCurrentUser ? 'No puedes borrar tu propio usuario' : 'Dar de baja usuario'}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Baja
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">No hay usuarios que coincidan con la búsqueda.</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center font-mono text-xs uppercase tracking-widest text-slate-400">Cargando usuarios…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
