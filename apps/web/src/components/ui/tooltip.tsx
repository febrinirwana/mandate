"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Carbon chip tooltip. Keyboard reachable: focus opens it too. */
export function Tip({
  children,
  content,
  className,
}: {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}) {
  return (
    <RadixTooltip.Provider delayDuration={180} skipDelayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild className={className}>
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={10}
            className="z-[100] max-w-[280px] rounded-[4px] bg-ink px-3 py-2 text-paper shadow-[0_12px_28px_-12px_rgb(26_25_22/0.4)] data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          >
            <span className="mono-data block leading-snug">{content}</span>
            <RadixTooltip.Arrow className="fill-ink" width={11} height={5} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
