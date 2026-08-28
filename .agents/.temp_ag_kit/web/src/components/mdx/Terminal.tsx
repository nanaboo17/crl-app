import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TerminalProps {
  title?: string;
  children: ReactNode;
}

export function Terminal({ title = "agent-session", children }: TerminalProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#0d0d0f] mb-6 overflow-hidden shadow-lg">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-[#18181b]">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/90" />
          <span className="w-3 h-3 rounded-full bg-amber-500/90" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/90" />
        </div>
        <span className="ml-2 font-mono text-xs text-zinc-500">{title}</span>
      </div>
      {/* Body */}
      <div className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

interface TerminalLineProps {
  type?: "user" | "agent" | "system";
  children: ReactNode;
}

export function TerminalLine({ type = "system", children }: TerminalLineProps) {
  const config = {
    user: { prompt: "$", color: "text-term-green" },
    agent: { prompt: "▸", color: "text-term-cyan" },
    system: { prompt: "", color: "text-zinc-500" },
  };
  const { prompt, color } = config[type];

  return (
    <span className="mb-2 flex gap-2">
      {prompt && <span className={cn("font-bold shrink-0", color)}>{prompt}</span>}
      <span className="flex-1">{children}</span>
    </span>
  );
}

interface TerminalBlockProps {
  highlight?: boolean;
  children: ReactNode;
}

export function TerminalBlock({ highlight, children }: TerminalBlockProps) {
  return (
    <div
      className={cn(
        "pl-4 border-l-2 mb-4",
        highlight ? "border-term-green" : "border-zinc-800"
      )}
    >
      {children}
    </div>
  );
}
