export type AppRole = 'agent' | 'admin' | 'superadmin'

export function rolePath(role: AppRole) {
  if (role === 'superadmin') return '/superadmin'
  if (role === 'admin') return '/admin'
  return '/agent'
}
