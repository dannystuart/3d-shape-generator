/** Saves a blob as a file. Works over http(s); see the file:// gotcha if this ever runs from disk. */
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "star-5-gold": the file name for anything exported from this spec. */
export const fileStem = (spec: { shape: string; material: string }) => `${spec.shape}-${spec.material}`.replace(/[^a-z0-9-]/gi, "-");
