"use client";

import Link from "next/link";
import agents from '@/services/agents.json';
import skills from '@/services/skills.json';
import workflows from '@/services/workflows.json';
import { useI18n } from "@/i18n/provider";

export default function DocsPage() {
    const { t } = useI18n();
    return (
        <div className="max-w-3xl">
            {/* Page Header */}
            <div className="mb-8 pb-8 border-b border-zinc-200 dark:border-zinc-800">
                <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.docsHome.title}
                </h1>
                <p className="text-lg text-zinc-600 dark:text-zinc-400">
                    {t.docsHome.welcomePre}<span className="before:-inset-x-1 before:-rotate-1 relative z-4 before:pointer-events-none before:absolute before:inset-y-0 before:z-4 before:bg-linear-to-r before:from-blue-500 before:via-cyan-500 before:to-orange-500 before:opacity-16 before:mix-blend-hard-light">
                        AG Kit
                    </span>{t.docsHome.welcomePost}
                </p>
            </div>

            {/* What is AG Kit */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.docsHome.whatIsPre}<span className="before:-inset-x-1 before:-rotate-1 relative z-4 before:pointer-events-none before:absolute before:inset-y-0 before:z-4 before:bg-linear-to-r before:from-blue-500 before:via-cyan-500 before:to-orange-500 before:opacity-16 before:mix-blend-hard-light">
                        AG Kit
                    </span>{t.docsHome.whatIsPost}
                </h2>
                <p className="text-base text-zinc-600 dark:text-zinc-400 mb-4">
                    <span className="before:-inset-x-1 before:-rotate-1 relative z-4 before:pointer-events-none before:absolute before:inset-y-0 before:z-4 before:bg-linear-to-r before:from-blue-500 before:via-cyan-500 before:to-orange-500 before:opacity-16 before:mix-blend-hard-light">
                        AG Kit
                    </span>{t.docsHome.whatIsP1}
                </p>
                <p className="text-base text-zinc-600 dark:text-zinc-400 mb-4">
                    {t.docsHome.whatIsP2a}{skills.length}{t.docsHome.whatIsP2b}{agents.length}{t.docsHome.whatIsP2c}{workflows.length}{t.docsHome.whatIsP2d}
                </p>
            </section>

            {/* What's Included */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.docsHome.includedTitle}
                </h2>
                <div className="grid gap-4 sm:grid-cols-3 mb-6">
                    <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{agents.length}+</div>
                        <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t.docsHome.specialistAgents}</div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                            {t.docsHome.specialistAgentsDesc}
                        </p>
                    </div>
                    <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{skills.length}+</div>
                        <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t.docsHome.domainSkills}</div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                            {t.docsHome.domainSkillsDesc}
                        </p>
                    </div>
                    <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                        <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{workflows.length}+</div>
                        <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t.docsHome.workflowsLabel}</div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
                            {t.docsHome.workflowsDesc}
                        </p>
                    </div>
                </div>
            </section>

            {/* How to Use the Docs */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.docsHome.howToTitle}
                </h2>
                <p className="text-base text-zinc-600 dark:text-zinc-400 mb-4">
                    {t.docsHome.howToP}
                </p>
                <div className="space-y-4 mb-6">
                    <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <Link href="/docs/installation" className="font-semibold text-zinc-900 dark:text-zinc-50 hover:underline">
                            {t.docsHome.gettingStarted}
                        </Link>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {t.docsHome.gettingStartedDesc}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <Link href="/docs/agents" className="font-semibold text-zinc-900 dark:text-zinc-50 hover:underline">
                            {t.docsHome.coreConcepts}
                        </Link>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {t.docsHome.coreConceptsDesc}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <Link href="/docs/cli" className="font-semibold text-zinc-900 dark:text-zinc-50 hover:underline">
                            {t.docsHome.cliRef}
                        </Link>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {t.docsHome.cliRefDesc}
                        </p>
                    </div>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t.docsHome.sidebarHintPre}<kbd className="px-2 py-1 text-xs font-mono rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">Ctrl+K</kbd>{t.docsHome.sidebarHintPost}
                </p>
            </section>

            {/* Next Steps */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.docsHome.nextStepsTitle}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Link
                        href="/docs/installation"
                        className="group p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{t.docsHome.installationArrow}</h3>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {t.docsHome.installationArrowDesc}
                        </p>
                    </Link>
                    <Link
                        href="/docs/agents"
                        className="group p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{t.docsHome.learnCoreArrow}</h3>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {t.docsHome.learnCoreArrowDesc}
                        </p>
                    </Link>
                </div>
            </section>

            {/* Footer Navigation */}
            <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="text-sm text-zinc-500 dark:text-zinc-500">
                    {t.docsHome.footerGettingStarted}
                </div>
                <Link
                    href="/docs/installation"
                    className="text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:underline flex items-center gap-1"
                >
                    {t.docsHome.footerInstallation}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>
        </div>
    );
}
