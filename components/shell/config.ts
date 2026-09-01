import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Route,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  href: string
  /** Translation key for the nav label. */
  labelKey: string
  icon: LucideIcon
  exact?: boolean
}

export type NavGroup = { labelKey: string; items: NavItem[] }

export type Role = 'superadmin' | 'admin' | 'agent'

export type ShellConfig = {
  role: Role
  home: string
  brandLabel: string
  navAriaKey: string
  navGroups: NavGroup[]
}

const overviewGroup = (items: NavItem[]): NavGroup => ({
  labelKey: 'common.overview',
  items,
})

const managementGroup = (items: NavItem[]): NavGroup => ({
  labelKey: 'common.management',
  items,
})

export const superadminConfig: ShellConfig = {
  role: 'superadmin',
  home: '/superadmin',
  brandLabel: 'CRL',
  navAriaKey: 'nav.aria.superadmin',
  navGroups: [
    overviewGroup([
      { href: '/superadmin', labelKey: 'common.dashboard', icon: LayoutDashboard, exact: true },
    ]),
    managementGroup([
      { href: '/superadmin/agents', labelKey: 'nav.agents', icon: Users },
      { href: '/superadmin/customers', labelKey: 'nav.customers', icon: Building2 },
      { href: '/superadmin/pre-visits', labelKey: 'nav.preVisits', icon: ClipboardList },
      { href: '/superadmin/visits', labelKey: 'nav.visits', icon: MapPin },
    ]),
  ],
}

export const adminConfig: ShellConfig = {
  role: 'admin',
  home: '/admin',
  brandLabel: 'CRL',
  navAriaKey: 'nav.aria.admin',
  navGroups: [
    overviewGroup([
      { href: '/admin', labelKey: 'common.dashboard', icon: LayoutDashboard, exact: true },
    ]),
    managementGroup([
      { href: '/admin/customers', labelKey: 'nav.customers', icon: Building2 },
      { href: '/admin/visits', labelKey: 'nav.visits', icon: MapPin },
      { href: '/admin/pre-visits', labelKey: 'nav.preVisits', icon: ClipboardList },
    ]),
  ],
}

export const agentConfig: ShellConfig = {
  role: 'agent',
  home: '/agent',
  brandLabel: 'CRL',
  navAriaKey: 'nav.aria.agent',
  navGroups: [
    overviewGroup([
      { href: '/agent', labelKey: 'common.dashboard', icon: LayoutDashboard, exact: true },
    ]),
    managementGroup([
      { href: '/agent/customers', labelKey: 'nav.customers', icon: Building2 },
      { href: '/agent/route', labelKey: 'nav.route', icon: Route },
      { href: '/agent/pre-visits', labelKey: 'nav.preVisits', icon: ClipboardList },
      { href: '/agent/visits', labelKey: 'nav.visits', icon: MapPin },
    ]),
  ],
}
