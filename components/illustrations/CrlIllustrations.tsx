type IllustrationProps = {
  className?: string
  title?: string
}

function SvgShell({ className, title, children, viewBox = '0 0 320 220' }: IllustrationProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg className={className} viewBox={viewBox} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  )
}

export function CrlRecoveryIllustration({ className, title }: IllustrationProps) {
  return (
    <SvgShell className={className} title={title}>
      <rect x="40" y="34" width="240" height="152" rx="30" fill="#fff" opacity=".82" />
      <circle cx="100" cy="108" r="42" fill="#efe6ff" />
      <path d="M83 119c10-22 28-31 46-20 13 8 18 26 8 40-13 18-42 16-54-3" fill="none" stroke="#7c5ce4" strokeWidth="10" strokeLinecap="round" />
      <path d="M137 93l2 24-23-6" fill="none" stroke="#7c5ce4" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="166" y="70" width="74" height="16" rx="8" fill="#24101d" opacity=".9" />
      <rect x="166" y="98" width="48" height="10" rx="5" fill="#ec008c" opacity=".8" />
      <rect x="166" y="119" width="62" height="10" rx="5" fill="#f1c64b" opacity=".9" />
      <rect x="166" y="140" width="42" height="10" rx="5" fill="#38a169" opacity=".8" />
      <circle cx="248" cy="58" r="13" fill="#ec008c" opacity=".14" />
      <circle cx="62" cy="62" r="8" fill="#f1c64b" opacity=".5" />
    </SvgShell>
  )
}

export function CrlRouteIllustration({ className, title }: IllustrationProps) {
  return (
    <SvgShell className={className} title={title}>
      <path d="M38 165c45-70 83-21 118-70 34-47 67-33 126 4" fill="none" stroke="#d7c7f6" strokeWidth="18" strokeLinecap="round" />
      <path d="M39 165c45-70 83-21 118-70 34-47 67-33 126 4" fill="none" stroke="#7c5ce4" strokeWidth="5" strokeLinecap="round" strokeDasharray="12 12" />
      <circle cx="51" cy="156" r="17" fill="#fff" stroke="#7c5ce4" strokeWidth="5" />
      <circle cx="51" cy="156" r="6" fill="#7c5ce4" />
      <path d="M159 50c-18 0-32 14-32 32 0 25 32 55 32 55s32-30 32-55c0-18-14-32-32-32Z" fill="#ec008c" opacity=".9" />
      <circle cx="159" cy="82" r="11" fill="#fff" />
      <path d="M258 83c-13 0-23 10-23 23 0 18 23 40 23 40s23-22 23-40c0-13-10-23-23-23Z" fill="#f1c64b" />
      <circle cx="258" cy="106" r="8" fill="#fff" />
      <rect x="83" y="34" width="52" height="26" rx="13" fill="#e7f5eb" />
      <path d="m100 47 8 8 14-17" fill="none" stroke="#38a169" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </SvgShell>
  )
}

export function CrlFollowUpIllustration({ className, title }: IllustrationProps) {
  return (
    <SvgShell className={className} title={title}>
      <rect x="58" y="38" width="204" height="140" rx="28" fill="#f7f2ff" />
      <circle cx="112" cy="104" r="34" fill="#fff" />
      <path d="M99 91c8-8 20-9 29-2 10 8 12 23 5 33-8 11-24 14-35 6" fill="none" stroke="#7c5ce4" strokeWidth="7" strokeLinecap="round" />
      <path d="M97 91v16h16" fill="none" stroke="#7c5ce4" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="163" y="70" width="62" height="13" rx="6.5" fill="#24101d" opacity=".88" />
      <rect x="163" y="94" width="78" height="10" rx="5" fill="#c9b8eb" />
      <rect x="163" y="114" width="55" height="10" rx="5" fill="#c9b8eb" />
      <rect x="163" y="136" width="64" height="22" rx="11" fill="#ec008c" opacity=".14" />
      <circle cx="232" cy="54" r="10" fill="#f1c64b" opacity=".65" />
    </SvgShell>
  )
}

export function CrlAnalyticsIllustration({ className, title }: IllustrationProps) {
  return (
    <SvgShell className={className} title={title}>
      <rect x="45" y="34" width="230" height="150" rx="26" fill="#fff" opacity=".86" />
      <path d="M76 151V92M111 151v-35M146 151V72M181 151v-56M216 151v-82" stroke="#d8caf6" strokeWidth="18" strokeLinecap="round" />
      <path d="M74 130 111 113l35 5 36-34 37-20" fill="none" stroke="#7c5ce4" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="74" cy="130" r="7" fill="#ec008c" />
      <circle cx="111" cy="113" r="7" fill="#ec008c" />
      <circle cx="146" cy="118" r="7" fill="#ec008c" />
      <circle cx="182" cy="84" r="7" fill="#ec008c" />
      <circle cx="219" cy="64" r="7" fill="#ec008c" />
      <rect x="80" y="50" width="64" height="11" rx="5.5" fill="#24101d" opacity=".82" />
      <circle cx="249" cy="155" r="18" fill="#e7f5eb" />
      <path d="m240 155 6 6 12-15" fill="none" stroke="#38a169" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </SvgShell>
  )
}
