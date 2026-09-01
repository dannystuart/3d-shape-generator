"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { mount } from "@/engine/renderer";
import type { Handle } from "@/engine/renderer";
import type { Spec } from "@/engine/spec";

export interface ShapePreviewProps {
  spec: Spec;
  className?: string;
  style?: CSSProperties;
  interactive?: boolean;
  /** Allow wheel zoom. Defaults to true; a host can set false to keep drag/rotate but let the page scroll. */
  zoom?: boolean;
  assetBase?: string;
  /** Handed the live handle once it exists, for the export menu and the camera chips. */
  onReady?: (handle: Handle) => void;
  /** The engine could not start — usually no WebGL. */
  onError?: (error: Error) => void;
  /** The new spec could not be drawn (an SVG that will not extrude); the old shape stays. */
  onSpecError?: (error: Error) => void;
}

/**
 * Mounts the engine into a div and gets out of the way.
 *
 * Deliberately thin: React owns the element, the engine owns everything inside
 * it. Nothing about the scene is expressed in JSX, because the same engine has
 * to run inside the snippet people copy out — a React implementation here
 * would be a second implementation of the same scene, drifting from the first.
 */
export function ShapePreview({ spec, className, style, interactive = true, zoom = true, assetBase, onReady, onError, onSpecError }: ShapePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<Handle | null>(null);

  // The latest props, for the effects to read. The editor re-renders on every
  // slider move, and putting `spec` in the mount effect's dependencies would
  // tear the renderer down and rebuild it each time.
  const latest = useRef({ spec, onReady, onError, onSpecError });
  useLayoutEffect(() => {
    latest.current = { spec, onReady, onError, onSpecError };
  }, [spec, onReady, onError, onSpecError]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let handle: Handle;
    try {
      handle = mount(host, { spec: latest.current.spec, interactive, zoom, assetBase });
    } catch (error) {
      latest.current.onError?.(error as Error);
      return;
    }
    handleRef.current = handle;
    latest.current.onReady?.(handle);
    return () => {
      handleRef.current = null;
      handle.dispose();
    };
  }, [interactive, zoom, assetBase]);

  useEffect(() => {
    try {
      handleRef.current?.setSpec(spec);
    } catch (error) {
      latest.current.onSpecError?.(error as Error);
    }
  }, [spec]);

  return <div ref={hostRef} className={className} style={style} />;
}
