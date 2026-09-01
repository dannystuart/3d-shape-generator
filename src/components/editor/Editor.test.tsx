import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const seen: unknown[] = [];
vi.mock("@/engine/renderer", () => ({
  mount: (_el: HTMLElement, options: { spec: unknown }) => {
    seen.push(options.spec);
    return {
      setSpec: (s: unknown) => seen.push(s),
      invalidate() {},
      resize() {},
      snapshot: async () => ({ blob: new Blob(), scale: 1 }),
      mesh: () => null,
      camera: () => ({ azimuth: 0, elevation: 0, zoom: 1 }),
      onCamera: () => () => {},
      onEnvironment: () => () => {},
      onEffectFailed: () => () => {},
      dispose() {},
    };
  },
}));

import { DEFAULT_SPEC } from "@/engine/spec";
import { Editor } from "./Editor";
import { toShareHash } from "./share";

beforeEach(() => {
  seen.length = 0;
  window.localStorage.clear();
  Object.defineProperty(window, "matchMedia", { writable: true, value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }) });
});
afterEach(cleanup);

const last = () => seen[seen.length - 1] as Record<string, unknown>;

describe("the editor", () => {
  it("names the tool and opens on a sphere", () => {
    render(<Editor />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/3D shape generator/i);
    expect(last().shape).toBe("sphere");
  });

  it("picking a shape tile sends the new shape, with its own dials, to the engine", async () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Torus" }));
    await waitFor(() => expect(last().shape).toBe("torus"));
    expect(last().shapeC).toBe(64);
    expect(screen.queryByText(/Edited/)).toBeNull();
  });

  it("surprise me changes the shape or the material", async () => {
    render(<Editor />);
    const before = last() as { shape: string; material: string };
    fireEvent.click(screen.getByRole("button", { name: /surprise me/i }));
    await waitFor(() => {
      const now = last() as { shape: string; material: string };
      expect(now.shape !== before.shape || now.material !== before.material).toBe(true);
    });
  });

  it("offers one step back after a surprise, and takes it", async () => {
    render(<Editor />);
    expect(screen.queryByRole("button", { name: /undo$/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /surprise me/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /undo$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /undo$/i }));
    await waitFor(() => expect(last().shape).toBe("sphere"));
    expect(screen.queryByRole("button", { name: /undo$/i })).toBeNull();
  });

  it("reset all goes back to the opening design, with a way back", async () => {
    window.localStorage.setItem("sg.spec", JSON.stringify({ shape: "heart", backdropColor: "#ff0000" }));
    render(<Editor />);
    await waitFor(() => expect(last().shape).toBe("heart"));
    fireEvent.click(screen.getByRole("button", { name: /reset all/i }));
    await waitFor(() => expect(last().shape).toBe("sphere"));
    expect(last().backdropColor).toBe(DEFAULT_SPEC.backdropColor);
    expect(screen.getByRole("button", { name: /undo$/i })).toBeInTheDocument();
  });

  it("opens a shared link's design, and clears the link", async () => {
    window.location.hash = toShareHash({ ...DEFAULT_SPEC, shape: "torus", color: "#123456" });
    render(<Editor />);
    await waitFor(() => expect(last().shape).toBe("torus"));
    expect(last().color).toBe("#123456");
    expect(window.location.hash).toBe("");
  });

  it("comes back from localStorage", async () => {
    window.localStorage.setItem("sg.spec", JSON.stringify({ shape: "heart", roughness: 0.2 }));
    render(<Editor />);
    await waitFor(() => expect(last().shape).toBe("heart"));
    expect(last().roughness).toBe(0.2);
  });

  it("opens on the provided initial spec when there is no share hash", async () => {
    window.location.hash = "";
    render(<Editor initialSpec={{ ...DEFAULT_SPEC, shape: "torus", material: "chrome" }} />);
    await waitFor(() => expect(last().shape).toBe("torus"));
    expect(last().material).toBe("chrome");
  });

  it("a share hash still beats the initial spec", async () => {
    window.location.hash = toShareHash({ ...DEFAULT_SPEC, shape: "gem" });
    render(<Editor initialSpec={{ ...DEFAULT_SPEC, shape: "torus" }} />);
    await waitFor(() => expect(last().shape).toBe("gem"));
  });

  /**
   * Development StrictMode runs the read-the-opening-spec effect twice. The
   * first pass consumes the share hash and clears it from the address bar; a
   * second pass that re-read the world would find no hash, fall back to the
   * initial spec and stomp the shared design — a link that works in
   * production and silently loses the design on every dev server.
   */
  it("keeps a shared link's design through StrictMode's double mount", async () => {
    const { StrictMode } = await import("react");
    window.location.hash = toShareHash({ ...DEFAULT_SPEC, shape: "gem" });
    render(
      <StrictMode>
        <Editor initialSpec={{ ...DEFAULT_SPEC, shape: "torus" }} />
      </StrictMode>,
    );
    await waitFor(() => expect(last().shape).toBe("gem"));
  });

  it("an initial spec beats what localStorage remembers", async () => {
    window.location.hash = "";
    window.localStorage.setItem("sg.spec", JSON.stringify({ ...DEFAULT_SPEC, shape: "star" }));
    render(<Editor initialSpec={{ ...DEFAULT_SPEC, shape: "torus" }} />);
    await waitFor(() => expect(last().shape).toBe("torus"));
  });
});
