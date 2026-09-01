"use client";

import { COPY } from "@/data/copy";

export interface DrawerHeaderProps {
  /** Some dial sits off where its preset put it. */
  edited: boolean;
  /** Anything at all differs from how the page opens. */
  changed: boolean;
  /** A Surprise or a Reset all just replaced the design; one step back is on offer. */
  canUndo: boolean;
  onUndo: () => void;
  onUndoEdits: () => void;
  onReset: () => void;
  onSurprise: () => void;
  onClose: () => void;
  query: string;
  onQuery: (query: string) => void;
}

const Reset = () => (
  <svg viewBox="0 0 16 16" width="10" height="10" fill="none" aria-hidden>
    <path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.48" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M2.4 2.6v3h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * The part of the drawer that never scrolls: what this is, the way back from
 * an edit, a roll of the dice, and the way to find a control among sixty.
 */
export function DrawerHeader({ edited, changed, canUndo, onUndo, onUndoEdits, onReset, onSurprise, onClose, query, onQuery }: DrawerHeaderProps) {
  return (
    <div className="relative z-[2] shrink-0 border-b border-sg-line bg-sg-panel px-4 pb-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[11px] uppercase leading-none tracking-[0.16em] text-sg-faint">{COPY.h1}</h1>
        <button
          type="button"
          onClick={onClose}
          aria-expanded
          aria-label="Close the tools"
          title="Close the tools"
          className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-sg-muted transition-[background-color,color,transform] duration-150 hover:bg-white/[0.07] hover:text-text active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60 motion-reduce:transition-none"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden>
            <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Two ways back, for two distances. Undo edits walks the dials back
              to the presets you picked; Reset all puts the whole page back to
              how it opened — shape, material, room, backdrop, view, the lot. */}
          {edited ? (
            <button type="button" onClick={onUndoEdits} className="sg-chip sg-reset" title="Put every dial back where the presets had it">
              <Reset />
              Undo edits
            </button>
          ) : null}
          {changed ? (
            <button type="button" onClick={onReset} className="sg-chip" title="Back to the shape, material, room and backdrop the page opens with">
              Reset all
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {canUndo ? (
            <button type="button" onClick={onUndo} className="sg-chip" title="Bring back the design this replaced">
              ↶ Undo
            </button>
          ) : null}
          <button type="button" onClick={onSurprise} className="sg-chip" title="A new shape, material and room">
            ✦ Surprise me
          </button>
        </div>
      </div>

      <div className="relative mt-3">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sg-faint">
          <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.6" />
          <path d="m10.4 10.4 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onQuery("");
          }}
          placeholder="Search controls"
          aria-label="Search controls"
          className="h-9 w-full rounded-[10px] bg-sg-raised pl-8 pr-3 text-[12px] text-sg-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] placeholder:text-faint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/50"
        />
      </div>
    </div>
  );
}
