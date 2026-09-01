import { getLocale } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n'
import { allMessages } from '@/lib/i18n/messages'

export default async function NewAgentPage() {
  const locale = await getLocale()
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, allMessages, key, params)

  return (
    <main className="mobile-page">
      <section className="page-header">
        <p className="eyebrow">{t('agent.new.eyebrow')}</p>
        <h1>{t('agent.new.title')}</h1>
      </section>

      <div className="card">
        {t('agent.new.placeholder')}
      </div>
    </main>
  )
}