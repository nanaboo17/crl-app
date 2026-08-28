import { ReactNode } from "react";
import { Lightbulb } from "lucide-react";

interface TipProps {
  title: string;
  children: ReactNode;
}

export function Tip({ title, children }: TipProps) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 transition-colors hover:border-term-green/40">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-4 h-4 shrink-0 text-term-green" />
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h4>
      </div>
      <div className="text-sm text-zinc-600 dark:text-zinc-400 [&>p]:mb-0">
        {children}
      </div>
    </div>
  );
}

interface ProTipsProps {
  children: ReactNode;
}

export function ProTips({ children }: ProTipsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">{children}</div>
  );
}
