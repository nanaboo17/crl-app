'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const X_URL = 'https://x.com/vudovn354';
const SEEN_KEY = 'ag-kit-follow-x-dismissed';

const XIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

export default function FollowDialog() {
    const [open, setOpen] = useState(false);

    // Auto-open once on first visit; remember dismissal.
    useEffect(() => {
        if (localStorage.getItem(SEEN_KEY) !== '1') {
            const id = setTimeout(() => setOpen(true), 800);
            return () => clearTimeout(id);
        }
    }, []);

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) localStorage.setItem(SEEN_KEY, '1');
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger
                render={
                    <Button variant="ghost" size="icon" aria-label="Follow on X" />
                }
            >
                <XIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <XIcon className="w-5 h-5" />
                        <span>Follow AG Kit on X</span>
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                        Stay in the loop — new skills, agents, and releases are announced on X first.
                        Give us a follow and never miss an update.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-4">
                    <a
                        href={X_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleOpenChange(false)}
                        className="flex items-center gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group"
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-100">
                            <XIcon className="w-5 h-5 text-white dark:text-zinc-900" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-50 mb-0.5">@vudovn354</div>
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">Follow on X (Twitter)</div>
                        </div>
                        <svg className="w-5 h-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>

                <DialogFooter>
                    <DialogClose render={<Button variant="ghost" />}>
                        Maybe later
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
