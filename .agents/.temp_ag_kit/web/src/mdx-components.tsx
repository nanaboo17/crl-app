import type { MDXComponents } from "mdx/types";
import Link from "next/link";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children, id }) => (
      <h1 id={id} className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2 scroll-mt-20">
        {children}
      </h1>
    ),
    h2: ({ children, id }) => (
      <h2 id={id} className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4 mt-8 scroll-mt-20">
        {children}
      </h2>
    ),
    h3: ({ children, id }) => (
      <h3 id={id} className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3 mt-6 scroll-mt-20">
        {children}
      </h3>
    ),
    h4: ({ children, id }) => (
      <h4 id={id} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2 mt-4 scroll-mt-20">
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">{children}</p>
    ),
    a: ({ href, children }) => {
      const isExternal = href?.startsWith("http");
      if (isExternal) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-term-cyan hover:underline underline-offset-4"
          >
            {children}
          </a>
        );
      }
      return (
        <Link
          href={href || "#"}
          className="text-term-cyan hover:underline underline-offset-4"
        >
          {children}
        </Link>
      );
    },
    ul: ({ children }) => (
      <ul className="list-disc list-outside pl-5 text-zinc-700 dark:text-zinc-300 space-y-1.5 mb-4 marker:text-zinc-400 dark:marker:text-zinc-600">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside pl-5 text-zinc-700 dark:text-zinc-300 space-y-1.5 mb-4 marker:text-zinc-400 dark:marker:text-zinc-600">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    // Inline code only. Fenced code blocks are wrapped by rehype-pretty-code
    // in a <pre> (styled via globals.css), so this never double-boxes them.
    code: ({ children }) => (
      <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[0.85em] font-mono text-term-cyan dark:text-term-cyan">
        {children}
      </code>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-term-cyan/40 bg-term-cyan/5 rounded-r px-4 py-2 text-zinc-600 dark:text-zinc-400 mb-4 [&>p]:mb-0">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-zinc-200 dark:border-zinc-800 my-8" />,
    table: ({ children }) => (
      <div className="overflow-x-auto mb-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50 bg-zinc-50 dark:bg-zinc-900">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 border-t border-zinc-200 dark:border-zinc-800">
        {children}
      </td>
    ),
    ...components,
  };
}
