import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FeatureProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function Feature({ title, description, children }: FeatureProps) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-center transition-colors hover:border-term-cyan/40">
      <div className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </div>
      {description && (
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {description}
        </div>
      )}
      {children}
    </div>
  );
}

interface FeatureGridProps {
  cols?: 2 | 3 | 4;
  children: ReactNode;
}

export function FeatureGrid({ cols = 4, children }: FeatureGridProps) {
  const colsClass = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 mb-6">
      <div className={cn("grid gap-3", colsClass[cols])}>{children}</div>
    </div>
  );
}
