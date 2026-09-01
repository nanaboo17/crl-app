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
  label: string
  icon: LucideIcon
  exact?: boolean
}

export type NavGroup = { label: string; items: NavItem[] }

export type ShellConfig = {
  role: string
  home: string
  brandLabel: string
  navAriaLabel: string
  navGroups: NavGroup[]
}

export const superadminConfig: ShellConfig = {
  role: 'Superadmin',
  home: '/superadmin',
  brandLabel: 'CRL Admin',
  navAriaLabel: 'Superadmin navigation',
  navGroups: [
    {
      label: 'Overview',
      items: [
        {
          href: '/superadmin',
          label: 'Dashboard',
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      label: 'Management',
      items: [
        { href: '/superadmin/agents', label: 'Agents', icon: Users },
        { href: '/superadmin/customers', label: 'Customers', icon: Building2 },
        { href: '/superadmin/pre-visits', label: 'Pre-Visits', icon: ClipboardList },
        { href: '/superadmin/visits', label: 'Visits', icon: MapPin },
      ],
    },
  ],
}

export const adminConfig: ShellConfig = {
  role: 'Admin',
  home: '/admin',
  brandLabel: 'CRL Admin',
  navAriaLabel: 'Admin navigation',
  navGroups: [
    {
      label: 'Overview',
      items: [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      ],
    },
    {
      label: 'Management',
      items: [
        { href: '/admin/customers', label: 'Customers', icon: Building2 },
        { href: '/admin/visits', label: 'Visits', icon: MapPin },
        { href: '/admin/pre-visits', label: 'Pre-Visits', icon: ClipboardList },
      ],
    },
  ],
}

export const agentConfig: ShellConfig = {
  role: 'Agent',
  home: '/agent',
  brandLabel: 'CRL Agent',
  navAriaLabel: 'Agent navigation',
  navGroups: [
    {
      label: 'Overview',
      items: [
        { href: '/agent', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      ],
    },
    {
      label: 'Management',
      items: [
        { href: '/agent/customers', label: 'Customers', icon: Building2 },
        { href: '/agent/route', label: 'Route', icon: Route },
        { href: '/agent/pre-visits', label: 'Pre-Visits', icon: ClipboardList },
        { href: '/agent/visits', label: 'Visits', icon: MapPin },
      ],
    },
  ],
}
