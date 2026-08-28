"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/provider";

export default function CLIPage() {
    const { t } = useI18n();
    return (
        <div className="max-w-3xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                <Link href="/docs" className="hover:text-zinc-900 dark:hover:text-zinc-50">{t.cliPage.breadcrumbDocs}</Link>
                <span>/</span>
                <span className="text-zinc-900 dark:text-zinc-50">{t.cliPage.breadcrumbCurrent}</span>
            </nav>

            {/* Page Header */}
            <div className="mb-8 pb-8 border-b border-zinc-200 dark:border-zinc-800">
                <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.cliPage.title}
                </h1>
                <p className="text-lg text-zinc-600 dark:text-zinc-400">
                    {t.cliPage.subtitle}
                </p>
            </div>

            {/* Overview */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.cliPage.overviewTitle}
                </h2>
                <p className="text-base text-zinc-600 dark:text-zinc-400 mb-6">
                    {t.cliPage.overviewPa}<code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">ag-kit</code>{t.cliPage.overviewPb}
                </p>
            </section>

            {/* Commands */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.cliPage.commandsTitle}
                </h2>

                <div className="space-y-8">
                    {/* init */}
                    <div>
                        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                            <code className="font-mono">ag-kit init</code>
                        </h3>
                        <p className="text-base text-zinc-600 dark:text-zinc-400 mb-4">
                            {t.cliPage.initDescA}<code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-sm font-mono">.agents</code>{t.cliPage.initDescB}
                        </p>

                        <div className="relative group mb-4">
                            <pre className="p-4 rounded-lg bg-zinc-900 dark:bg-zinc-900 overflow-x-auto border border-zinc-800 font-mono text-sm">
                                <code className="text-zinc-100">ag-kit init</code>
                            </pre>
                        </div>

                        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">{t.cliPage.behaviorTitle}</div>
                            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                                <li>• {t.cliPage.initBehavior1a}<code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-xs">.agents/</code>{t.cliPage.initBehavior1b}</li>
                                <li>• {t.cliPage.initBehavior2}</li>
                                <li>• {t.cliPage.initBehavior3a}<code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-xs">.agents/</code>{t.cliPage.initBehavior3b}<code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-xs">--force</code>{t.cliPage.initBehavior3c}</li>
                            </ul>
                        </div>
                    </div>

                    {/* update */}
                    <div>
                        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                            <code className="font-mono">ag-kit update</code>
                        </h3>
                        <p className="text-base text-zinc-600 dark:text-zinc-400 mb-4">
                            {t.cliPage.updateDesc}
                        </p>

                        <div className="relative group mb-4">
                            <pre className="p-4 rounded-lg bg-zinc-900 dark:bg-zinc-900 overflow-x-auto border border-zinc-800 font-mono text-sm">
                                <code className="text-zinc-100">ag-kit update</code>
                            </pre>
                        </div>

                        <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
                            <p className="text-sm text-amber-900 dark:text-amber-200">
                                <strong className="font-semibold">{t.cliPage.updateWarningStrong}</strong>{t.cliPage.updateWarningA}<code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 font-mono text-xs">.agents/</code>{t.cliPage.updateWarningB}
                            </p>
                        </div>
                    </div>

                    {/* status */}
                    <div>
                        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                            <code className="font-mono">ag-kit status</code>
                        </h3>
                        <p className="text-base text-zinc-600 dark:text-zinc-400 mb-4">
                            {t.cliPage.statusDesc}
                        </p>

                        <div className="relative group mb-4">
                            <pre className="p-4 rounded-lg bg-zinc-900 dark:bg-zinc-900 overflow-x-auto border border-zinc-800 font-mono text-sm">
                                <code className="text-zinc-100">ag-kit status</code>
                            </pre>
                        </div>

                        <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">{t.cliPage.outputIncludesTitle}</div>
                            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                                <li>• {t.cliPage.statusOut1}</li>
                                <li>• {t.cliPage.statusOut2}</li>
                                <li>• {t.cliPage.statusOut3}</li>
                                <li>• {t.cliPage.statusOut4a}<code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">.agents</code>{t.cliPage.statusOut4b}</li>
                                <li>• {t.cliPage.statusOut5}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Options */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.cliPage.optionsTitle}
                </h2>
                <p className="text-base text-zinc-600 dark:text-zinc-400 mb-6">
                    {t.cliPage.optionsP}
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-zinc-200 dark:border-zinc-800">
                        <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                            <tr>
                                <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-50 border-b border-zinc-200 dark:border-zinc-800">{t.cliPage.tableOption}</th>
                                <th className="text-left py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-50 border-b border-zinc-200 dark:border-zinc-800">{t.cliPage.tableDescription}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            <tr>
                                <td className="py-3 px-4">
                                    <code className="font-mono text-zinc-900 dark:text-zinc-50">-f, --force</code>
                                </td>
                                <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                                    {t.cliPage.optForceA}<code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">.agents</code>{t.cliPage.optForceB}<code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">update</code>{t.cliPage.optForceC}
                                </td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4">
                                    <code className="font-mono text-zinc-900 dark:text-zinc-50">-p, --path &lt;dir&gt;</code>
                                </td>
                                <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                                    {t.cliPage.optPathDesc}
                                </td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4">
                                    <code className="font-mono text-zinc-900 dark:text-zinc-50">-b, --branch &lt;name&gt;</code>
                                </td>
                                <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                                    {t.cliPage.optBranchDesc}
                                </td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4">
                                    <code className="font-mono text-zinc-900 dark:text-zinc-50">-q, --quiet</code>
                                </td>
                                <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                                    {t.cliPage.optQuietDesc}
                                </td>
                            </tr>
                            <tr>
                                <td className="py-3 px-4">
                                    <code className="font-mono text-zinc-900 dark:text-zinc-50">--dry-run</code>
                                </td>
                                <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                                    {t.cliPage.optDryRunA}<code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">init</code>{t.cliPage.optDryRunB}<code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">update</code>{t.cliPage.optDryRunC}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Examples */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.cliPage.examplesTitle}
                </h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                            {t.cliPage.exForceReinstall}
                        </h3>
                        <div className="relative group">
                            <pre className="p-4 rounded-lg bg-zinc-900 dark:bg-zinc-900 overflow-x-auto border border-zinc-800 font-mono text-sm">
                                <code className="text-zinc-100">ag-kit init --force</code>
                            </pre>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                            {t.cliPage.exInstallDir}
                        </h3>
                        <div className="relative group">
                            <pre className="p-4 rounded-lg bg-zinc-900 dark:bg-zinc-900 overflow-x-auto border border-zinc-800 font-mono text-sm">
                                <code className="text-zinc-100">ag-kit init --path ./my-project</code>
                            </pre>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                            {t.cliPage.exDevBranch}
                        </h3>
                        <div className="relative group">
                            <pre className="p-4 rounded-lg bg-zinc-900 dark:bg-zinc-900 overflow-x-auto border border-zinc-800 font-mono text-sm">
                                <code className="text-zinc-100">ag-kit init --branch dev</code>
                            </pre>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                            {t.cliPage.exSilentCI}
                        </h3>
                        <div className="relative group">
                            <pre className="p-4 rounded-lg bg-zinc-900 dark:bg-zinc-900 overflow-x-auto border border-zinc-800 font-mono text-sm">
                                <code className="text-zinc-100">ag-kit init --quiet --force</code>
                            </pre>
                        </div>
                    </div>
                </div>
            </section>

            {/* Next Steps */}
            <section className="mb-12">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                    {t.cliPage.nextTitle}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Link
                        href="/docs/installation"
                        className="group p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                    >
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">{t.cliPage.installGuideArrow}</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {t.cliPage.installGuideDesc}
                        </p>
                    </Link>
                    <a
                        href="https://github.com/vudovn/ag-kit"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                    >
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">{t.cliPage.viewGithubArrow}</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {t.cliPage.viewGithubDesc}
                        </p>
                    </a>
                </div>
            </section>

            {/* Footer Navigation */}
            <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <Link
                    href="/docs/workflows"
                    className="text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:underline flex items-center gap-1"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t.cliPage.footerWorkflows}
                </Link>
                <a
                    href="https://github.com/vudovn/ag-kit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:underline flex items-center gap-1"
                >
                    GitHub
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            </div>
        </div>
    );
}
