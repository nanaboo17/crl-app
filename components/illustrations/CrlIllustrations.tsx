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

export function CrlChurnRiskIllustration({ className, title }: IllustrationProps) {
  return (
    <SvgShell className={className} title={title}>
      <rect x="45" y="35" width="230" height="150" rx="28" fill="#fff" opacity=".9" />
      <circle cx="104" cy="108" r="48" fill="#fff0f6" />
      <path d="M104 73v40" stroke="#ec008c" strokeWidth="10" strokeLinecap="round" />
      <circle cx="104" cy="133" r="6" fill="#ec008c" />
      <path d="M165 72h66M165 99h50M165 126h58" stroke="#d9cae9" strokeWidth="12" strokeLinecap="round" />
      <path d="M166 151c18-2 27-19 38-31 10-11 22-11 34-25" fill="none" stroke="#e5484d" strokeWidth="6" strokeLinecap="round" />
      <path d="m229 94 14 1-3 14" fill="none" stroke="#e5484d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="250" cy="56" r="10" fill="#f1c64b" opacity=".7" />
    </SvgShell>
  )
}

export function CrlPaymentIllustration({ className, title }: IllustrationProps) {
  return (
    <SvgShell className={className} title={title}>
      <rect x="52" y="42" width="216" height="136" rx="28" fill="#f7f2ff" />
      <rect x="74" y="70" width="105" height="72" rx="16" fill="#fff" stroke="#dfd1f4" strokeWidth="3" />
      <rect x="89" y="87" width="52" height="10" rx="5" fill="#24101d" opacity=".84" />
      <rect x="89" y="108" width="72" height="8" rx="4" fill="#d8caf0" />
      <circle cx="214" cy="106" r="38" fill="#e7f5eb" />
      <path d="M199 106h30M214 91v30" stroke="#38a169" strokeWidth="7" strokeLinecap="round" />
      <path d="m198 151 10 10 21-25" fill="none" stroke="#38a169" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="79" cy="57" r="9" fill="#ec008c" opacity=".18" />
      <circle cx="249" cy="62" r="8" fill="#f1c64b" opacity=".75" />
    </SvgShell>
  )
}

export function CrlTerritoryIllustration({ className, title }: IllustrationProps) {
  return (
    <SvgShell className={className} title={title}>
      <path d="M54 58 118 39l57 22 62-18 29 22-10 101-69 15-59-19-70 15Z" fill="#f2ecfb" stroke="#d5c7ec" strokeWidth="3" strokeLinejoin="round" />
      <path d="M119 40l9 122M175 61l12 120M237 44l19 122" stroke="#cdbbe8" strokeWidth="3" />
      <path d="M81 104c-13 0-23 10-23 23 0 18 23 39 23 39s23-21 23-39c0-13-10-23-23-23Z" fill="#ec008c" />
      <circle cx="81" cy="127" r="8" fill="#fff" />
      <path d="M163 70c-13 0-23 10-23 23 0 18 23 39 23 39s23-21 23-39c0-13-10-23-23-23Z" fill="#7c5ce4" />
      <circle cx="163" cy="93" r="8" fill="#fff" />
      <path d="M228 108c-12 0-21 9-21 21 0 17 21 36 21 36s21-19 21-36c0-12-9-21-21-21Z" fill="#f1c64b" />
      <circle cx="228" cy="129" r="7" fill="#fff" />
    </SvgShell>
  )
}

export function CrlTeamIllustration({ className, title }: IllustrationProps) {
  return (
    <SvgShell className={className} title={title}>
      <rect x="50" y="45" width="220" height="132" rx="30" fill="#fff" opacity=".88" />
      <circle cx="112" cy="91" r="22" fill="#efe6ff" />
      <circle cx="112" cy="84" r="9" fill="#7c5ce4" />
      <path d="M92 111c4-15 35-15 40 0" fill="#7c5ce4" opacity=".85" />
      <circle cx="205" cy="91" r="22" fill="#fff1c9" />
      <circle cx="205" cy="84" r="9" fill="#d49d00" />
      <path d="M185 111c4-15 35-15 40 0" fill="#d49d00" opacity=".85" />
      <path d="M137 91h43" stroke="#ec008c" strokeWidth="6" strokeLinecap="round" strokeDasharray="7 8" />
      <rect x="92" y="137" width="134" height="18" rx="9" fill="#e7f5eb" />
      <path d="m146 146 8 8 16-19" fill="none" stroke="#38a169" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="246" cy="62" r="8" fill="#ec008c" opacity=".18" />
    </SvgShell>
  )
}

export function CrlSuccessIllustration({ className, title }: IllustrationProps) {
  return (
    <SvgShell className={className} title={title}>
      <circle cx="160" cy="108" r="70" fill="#e7f5eb" />
      <circle cx="160" cy="108" r="48" fill="#fff" />
      <path d="m132 109 19 20 39-47" fill="none" stroke="#38a169" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M72 73 61 58M246 72l12-16M80 151l-17 10M241 151l17 10" stroke="#f1c64b" strokeWidth="7" strokeLinecap="round" />
      <circle cx="92" cy="54" r="7" fill="#ec008c" />
      <circle cx="232" cy="52" r="6" fill="#7c5ce4" />
      <circle cx="265" cy="117" r="7" fill="#ec008c" opacity=".6" />
    </SvgShell>
  )
}

export function CrlSearchIllustration({ className, title }: IllustrationProps) {
  return (
    <SvgShell className={className} title={title}>
      <rect x="52" y="42" width="216" height="136" rx="28" fill="#f7f2ff" />
      <rect x="76" y="65" width="115" height="82" rx="16" fill="#fff" />
      <rect x="92" y="83" width="62" height="10" rx="5" fill="#d4c6e9" />
      <rect x="92" y="104" width="78" height="9" rx="4.5" fill="#e2d8f1" />
      <rect x="92" y="124" width="48" height="9" rx="4.5" fill="#e2d8f1" />
      <circle cx="211" cy="103" r="30" fill="#efe6ff" stroke="#7c5ce4" strokeWidth="7" />
      <path d="m232 126 24 24" stroke="#7c5ce4" strokeWidth="9" strokeLinecap="round" />
      <circle cx="58" cy="78" r="8" fill="#f1c64b" opacity=".7" />
      <circle cx="253" cy="61" r="8" fill="#ec008c" opacity=".2" />
    </SvgShell>
  )
}
