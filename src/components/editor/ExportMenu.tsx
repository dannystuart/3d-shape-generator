"use client";

import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { download, fileStem } from "@/engine/export/download";
import { toGlb } from "@/engine/export/toGlb";
import { toHtml } from "@/engine/export/toHtml";
import { toPrompt } from "@/engine/export/toPrompt";
import type { Handle } from "@/engine/renderer";
import type { Spec } from "@/engine/spec";
import { copy } from "./clipboard";
import { toShareUrl } from "./share";

export interface ExportMenuProps {
  spec: Spec;
  /** The live engine, for the PNG and the GLB. Null until it has mounted. */
  handle: Handle | null;
}

type RowId = "png" | "code" | "prompt" | "glb" | "link";
type Scale = 1 | 2 | 4;
const SCALES: Scale[] = [1, 2, 4];

/**
 * Shut and open are the resting states. The two -ing ones exist so the exit gets
 * to play: an element dropped the instant it is asked to close has no chance to
 * animate out, and a menu that appears gently and vanishes instantly reads as a
 * bug rather than as a menu.
 */
type Phase = "shut" | "opening" | "open" | "closing";

const KB = (text: string) => `${(new Blob([text]).size / 1024).toFixed(1)}KB`;

/** How long the confirmation stays up before the row goes back to normal. */
const CONFIRM_MS = 1400;

const CodeGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path
      d="M5.8 4.4 2.4 8l3.4 3.6M10.2 4.4 13.6 8l-3.4 3.6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PromptGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path
      d="M13.4 8.4c0 2.4-2.4 4.3-5.4 4.3a6.7 6.7 0 0 1-1.6-.2l-3 1.1.9-2.3a4 4 0 0 1-1.7-3c0-2.4 2.4-4.3 5.4-4.3s5.4 1.9 5.4 4.4Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

const ImageGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="m3.5 11.5 3-3.2 2.2 2.2 1.6-1.6 2.4 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="10.4" cy="6.2" r="1" fill="currentColor" />
  </svg>
);

const CubeGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path d="M8 1.8 13.6 5v6L8 14.2 2.4 11V5L8 1.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M2.6 5.2 8 8.3l5.4-3.1M8 8.3v5.8" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const LinkGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path d="M6.8 9.2a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1M9.2 6.8a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const Tick = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path
      d="m3.4 8.4 3 3 6.2-6.6"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * The things you leave with: the code, a prompt, a link, a PNG and a 3D file.
 *
 * What it copies is exactly what the preview is running — the same engine, not a
 * description of it. It says so by being one tap: there is no panel of code to
 * read and then mistrust, because the thing on screen *is* the thing that lands
 * in the clipboard.
 */
export function ExportMenu({ spec, handle }: ExportMenuProps) {
  const [phase, setPhase] = useState<Phase>("shut");
  const [done, setDone] = useState<RowId | null>(null);
  const [failed, setFailed] = useState<RowId | null>(null);
  const [scale, setScale] = useState<Scale>(2);
  /** Drop the backdrop from the PNG, whatever the Backdrop section says. */
  const [clear, setClear] = useState(false);
  const [busy, setBusy] = useState<RowId | null>(null);
  /** What the PNG row says after a save — "Saved", or that 4× was too big here. */
  const [saved, setSaved] = useState<string | null>(null);

  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const mounted = phase !== "shut";
  const open = phase === "opening" || phase === "open";

  // Building fifty kilobytes of string on every frame of a slider drag is work
  // nobody is looking at. React can run it behind the preview instead.
  const settled = useDeferredValue(spec);

  const code = useMemo(() => toHtml({ spec: settled, id: `${fileStem(settled)}-3d` }), [settled]);
  const prompt = useMemo(() => toPrompt(settled), [settled]);
  // The page's own address with the design folded into it; read on arrival.
  const link = useMemo(() => (typeof window === "undefined" ? "" : toShareUrl(settled, window.location.href)), [settled]);

  // Two groups, because two verbs: the code and the prompt go to the clipboard,
  // the picture and the 3D file go to disk. Each row says which on the right,
  // so nobody has to guess that tapping the name is what takes it.
  const rows = useMemo(
    () => [
      { id: "code" as RowId, group: "Copy", label: "Code", text: code, sub: `Web snippet · ${KB(code)}`, Glyph: CodeGlyph },
      { id: "prompt" as RowId, group: "Copy", label: "Prompt", text: prompt, Glyph: PromptGlyph },
      { id: "link" as RowId, group: "Copy", label: "Link", text: link, Glyph: LinkGlyph },
      { id: "png" as RowId, group: "Download", label: "PNG", sub: saved ?? undefined, Glyph: ImageGlyph },
      { id: "glb" as RowId, group: "Download", label: "3D file", sub: "GLB", Glyph: CubeGlyph },
    ],
    [code, prompt, link, saved],
  );

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const shut = useCallback(() => {
    setPhase((current) => (current === "shut" || current === "closing" ? current : "closing"));
  }, []);

  /**
   * A backstop for the phase change that `animationend` normally makes.
   *
   * The event is the accurate signal and stays the primary one, but it is not a
   * guaranteed one: an environment with animations suppressed never fires it,
   * and a menu whose exit depends on an event that never arrives is a menu stuck
   * open. Generous enough that it only ever lands second.
   */
  useEffect(() => {
    if (phase === "shut" || phase === "open") return;
    const settleAt = phase === "opening" ? 400 : 260;
    const timer = setTimeout(() => {
      setPhase((current) =>
        current === "opening" ? "open" : current === "closing" ? "shut" : current,
      );
    }, settleAt);
    return () => clearTimeout(timer);
  }, [phase]);

  // Escape belongs to the document rather than to the menu: focus may be on the
  // trigger, on a row, or nowhere at all after a click.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      shut();
      trigger.current?.focus();
    };
    const onOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) shut();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [open, shut]);

  const onPick = async (row: (typeof rows)[number]) => {
    clearTimers();
    setFailed(null);
    setDone(null);
    setSaved(null);

    let ok = false;
    if (row.id === "png") {
      if (!handle) return;
      setBusy("png");
      try {
        const transparent = clear || spec.backdrop === "transparent";
        const out = await handle.snapshot({ scale, transparent });
        download(out.blob, `${fileStem(spec)}${transparent ? "-transparent" : ""}@${out.scale}x.png`);
        if (out.scale !== scale) setSaved(`Saved at ${out.scale}× — ${scale}× was too big for this device`);
        ok = true;
      } catch {
        ok = false;
      }
      setBusy(null);
    } else if (row.id === "glb") {
      if (!handle) return;
      setBusy("glb");
      try {
        const buffer = await toGlb(handle.mesh());
        download(new Blob([buffer], { type: "model/gltf-binary" }), `${fileStem(spec)}.glb`);
        ok = true;
      } catch {
        ok = false;
      }
      setBusy(null);
    } else {
      ok = await copy(row.text!);
    }
    if (ok) setDone(row.id);
    else setFailed(row.id);

    timers.current.push(
      setTimeout(() => {
        setDone(null);
        setFailed(null);
        setSaved(null);
      }, CONFIRM_MS),
      // Just after the row has gone back to normal, so the menu is never seen
      // closing on a green tick — the confirmation gets to finish first.
      setTimeout(shut, CONFIRM_MS + 200),
    );
  };

  return (
    <div className="relative" ref={root}>
      {mounted ? (
        <div
          role="menu"
          aria-label="Export"
          data-phase={phase}
          className="sg-export__menu"
          onAnimationEnd={(event) => {
            // The rows animate too, and their events bubble through here.
            if (event.target !== event.currentTarget) return;
            setPhase((current) =>
              current === "opening" ? "open" : current === "closing" ? "shut" : current,
            );
          }}
        >
          {rows.map((row, i) => {
            const confirmed = done === row.id;
            const missed = failed === row.id;
            const first = i === 0 || rows[i - 1].group !== row.group;
            const verb = row.text ? "Copy" : "Download";
            const action = confirmed ? (row.text ? "Copied" : "Saved") : missed ? (row.text ? "Press ⌘C" : "Failed") : busy === row.id ? "Saving…" : verb;
            return (
              <Fragment key={row.id}>
                {first ? (
                  <span role="presentation" className="sg-export__group" style={{ ["--i" as string]: i }}>
                    {row.group}
                  </span>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => onPick(row)}
                  style={{ ["--i" as string]: i }}
                  data-taken={confirmed || undefined}
                  className="sg-export__row"
                >
                  {/* A single sweep of light crossing the row on the way past.
                      The tick alone says "done" without saying anything happened;
                      something travelling says the thing was taken. */}
                  <span className="sg-export__sweep" aria-hidden />

                  <span className="sg-export__glyph" data-done={confirmed || undefined}>
                    <span className="sg-export__glyph-off">
                      <row.Glyph />
                    </span>
                    <span className="sg-export__glyph-on">
                      <Tick />
                    </span>
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                    <span className="truncate text-[12.5px] leading-none text-sg-text" style={{ minWidth: "2.6em" }}>{row.label}</span>
                    {row.sub ? <span className="truncate font-sg-mono text-[10px] leading-none text-sg-muted">{row.sub}</span> : null}
                  </span>

                  {/* The PNG's size sits beside its own Download, so the choice
                      and the thing it applies to are read in one glance. */}
                  {row.id === "png" && !confirmed ? (
                    <span className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()} role="presentation">
                      {/* Transparent: the backdrop left out of the file. Already so when the backdrop is None. */}
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Transparent"
                        aria-pressed={clear || spec.backdrop === "transparent"}
                        aria-disabled={spec.backdrop === "transparent" || undefined}
                        data-on={clear || spec.backdrop === "transparent" ? "" : undefined}
                        title={spec.backdrop === "transparent" ? "The backdrop is already None" : "Leave the backdrop out"}
                        className="sg-chip mr-1 px-1.5 text-[10px]"
                        onClick={() => setClear((c) => !c)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setClear((c) => !c);
                        }}
                      >
                        Clear
                      </span>
                      {SCALES.map((s) => (
                        <span
                          key={s}
                          role="button"
                          tabIndex={0}
                          aria-label={`${s}×`}
                          aria-pressed={scale === s}
                          data-on={scale === s ? "" : undefined}
                          className="sg-chip px-1.5 font-sg-mono text-[10px]"
                          onClick={() => setScale(s)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setScale(s);
                          }}
                        >
                          {s}×
                        </span>
                      ))}
                    </span>
                  ) : null}

                  <span className="sg-export__action" data-done={confirmed || undefined} aria-hidden>
                    {action}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      ) : null}

      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          clearTimers();
          setDone(null);
          setFailed(null);
          if (open) shut();
          else setPhase("opening");
        }}
        className="sg-export__trigger"
      >
        Export
        <svg
          viewBox="0 0 16 16"
          width="10"
          height="10"
          fill="none"
          aria-hidden
          className={`transition-transform duration-200 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="M4 9.8 8 6l4 3.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
