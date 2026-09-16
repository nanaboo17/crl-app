import type { ReactNode } from 'react'
import PreVisitViewChooser from './PreVisitViewChooser'

export default function PreVisitsLayout({ children }: { children: ReactNode }) {
  return <>
    <PreVisitViewChooser />
    {children}
  </>
}
