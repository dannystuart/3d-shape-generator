import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Handle } from "@/engine/renderer";
import { DEFAULT_SPEC } from "@/engine/spec";
import { ExportMenu } from "./ExportMenu";

afterEach(cleanup);

const written: string[] = [];
beforeEach(() => {
  written.length = 0;
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: async (text: string) => { written.push(text); } } });
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
});

const snapshot = vi.fn(async ({ scale }: { scale: number }) => ({ blob: new Blob(["png"]), scale }));
const handle = { snapshot } as unknown as Handle;

const menu = () => render(<ExportMenu spec={DEFAULT_SPEC} handle={handle} />);
const openIt = () => fireEvent.click(screen.getByRole("button", { name: /export/i }));

describe("the export menu", () => {
  it("offers five rows", () => {
    menu();
    openIt();
    expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toHaveLength(5);
    for (const name of [/^png/i, /^code/i, /^prompt/i, /^link/i, /^3d file/i]) expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
  });

  it("says what each row does, and groups them by it", () => {
    menu();
    openIt();
    // A heading and a verb on each of its two rows.
    expect(screen.getAllByText("Copy")).toHaveLength(4);
    expect(screen.getAllByText("Download")).toHaveLength(3);
    expect(screen.getByRole("menuitem", { name: /^code/i })).toHaveTextContent(/copy$/i);
    expect(screen.getByRole("menuitem", { name: /^png/i })).toHaveTextContent(/download$/i);
    expect(screen.getByRole("menuitem", { name: /^3d file/i })).toHaveTextContent(/download$/i);
  });

  it("copies the code, with the import map in it", async () => {
    menu();
    openIt();
    fireEvent.click(screen.getByRole("menuitem", { name: /^code/i }));
    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toContain('<script type="importmap">');
    await waitFor(() => expect(screen.getByText("Copied")).toBeInTheDocument());
  });

  it("copies the prompt from the same menu", async () => {
    menu();
    openIt();
    fireEvent.click(screen.getByRole("menuitem", { name: /^prompt/i }));
    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toMatch(/Render a 3D sphere/);
    expect(written[0]).not.toContain("<script");
  });

  it("copies a link that carries the design", async () => {
    render(<ExportMenu spec={{ ...DEFAULT_SPEC, shape: "heart" }} handle={handle} />);
    openIt();
    fireEvent.click(screen.getByRole("menuitem", { name: /^link/i }));
    await waitFor(() => expect(written).toHaveLength(1));
    expect(written[0]).toMatch(/#s=/);
  });

  it("saves a transparent PNG on request, without touching the backdrop setting", async () => {
    menu();
    openIt();
    fireEvent.click(screen.getByRole("button", { name: "Transparent" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^png/i }));
    await waitFor(() => expect(snapshot).toHaveBeenCalledWith({ scale: 2, transparent: true }));
  });

  it("saves a PNG at the chosen scale", async () => {
    menu();
    openIt();
    fireEvent.click(screen.getByRole("button", { name: "4×" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^png/i }));
    await waitFor(() => expect(snapshot).toHaveBeenCalledWith({ scale: 4, transparent: false }));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
  });
});
