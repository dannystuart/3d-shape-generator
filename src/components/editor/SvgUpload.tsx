"use client";

import { useRef } from "react";
import { pathDataFromSvg } from "@/engine/shapes/svgFile";

export interface SvgUploadProps {
  onUpload: (pathData: string, name: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Reads a dropped or chosen SVG file into path data, or says what went wrong. */
export async function readSvgFile(file: File, onUpload: SvgUploadProps["onUpload"], onError: SvgUploadProps["onError"]) {
  try {
    const text = await file.text();
    onUpload(pathDataFromSvg(text), file.name.replace(/\.svg$/i, ""));
  } catch (error) {
    onError(`Couldn't read that file. ${(error as Error).message}`);
  }
}

/** A chip that opens the file dialog; the Editor wires drag-and-drop on the scene. */
export function SvgUpload({ onUpload, onError, disabled, className, children }: SvgUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".svg,image/svg+xml"
        className="sr-only"
        aria-label="Upload an SVG"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void readSvgFile(file, onUpload, onError);
          e.target.value = "";
        }}
      />
      <button type="button" className={className ?? "sg-chip"} disabled={disabled} onClick={() => input.current?.click()}>
        {children ?? "⬆ SVG"}
      </button>
    </>
  );
}
