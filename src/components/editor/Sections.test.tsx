import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC } from "@/engine/spec";
import { Sections } from "./Sections";

const base = { spec: DEFAULT_SPEC, baseline: DEFAULT_SPEC, onChange: () => {}, onPickShape: () => {}, onPickEffect: () => {}, onPickTone: () => {}, onPickFinish: () => {}, onUpload: () => {}, onToast: () => {} };

describe("Sections", () => {
  it("draws the seven section headers", () => {
    render(<Sections {...base} />);
    for (const title of ["Shape", "Material", "Lighting", "Adjustments", "Effects", "Backdrop", "Camera"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${title}`) })).toBeInTheDocument();
    }
  });

  it("narrows to the matching controls when searched", () => {
    const coated = { ...DEFAULT_SPEC, clearcoat: 1 };
    render(<Sections {...base} spec={coated} baseline={coated} query="rough" />);
    expect(screen.getByLabelText("Roughness")).toBeInTheDocument();
    expect(screen.getByLabelText("Coat roughness")).toBeInTheDocument();
    expect(screen.queryByLabelText("Lens")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Camera/ })).toBeNull();
  });

  it("finds shapes, materials and rooms by name when searched", () => {
    render(<Sections {...base} query="heart" />);
    expect(screen.getByRole("button", { name: "Heart" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sphere" })).toBeNull();
    expect(screen.queryByText(/no controls match/i)).toBeNull();
  });

  it("hides a dial that qualifies another while that one is off", () => {
    const { unmount } = render(<Sections {...base} />);
    // One fold opens at a time, so the material section is behind its header.
    fireEvent.click(screen.getByRole("button", { name: /^Material/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Settings" }));
    expect(screen.queryByLabelText("Coat roughness")).toBeNull();
    expect(screen.queryByLabelText("Refraction")).toBeNull();
    expect(screen.queryByLabelText("Surface depth")).toBeNull();
    unmount();
    const glassy = { ...DEFAULT_SPEC, transmission: 1, surface: "cracks" };
    render(<Sections {...base} spec={glassy} baseline={glassy} />);
    fireEvent.click(screen.getByRole("button", { name: /^Material/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Settings" }));
    expect(screen.getByLabelText("Refraction")).toBeInTheDocument();
    expect(screen.getByLabelText("Surface depth")).toBeInTheDocument();
  });

  it("picking a material swatch moves the dials with it", () => {
    const onChange = vi.fn();
    render(<Sections {...base} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^Material/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chrome" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ material: "chrome", metalness: 1 }));
  });

  it("shows the extrude dials for a flat shape and the catalogue dials for a solid", () => {
    render(<Sections {...base} spec={{ ...DEFAULT_SPEC, shape: "star-5" }} baseline={{ ...DEFAULT_SPEC, shape: "star-5" }} />);
    expect(screen.getByLabelText("Thickness")).toBeInTheDocument();
    const { unmount } = render(<Sections {...base} spec={{ ...DEFAULT_SPEC, shape: "torus" }} baseline={{ ...DEFAULT_SPEC, shape: "torus" }} />);
    expect(screen.getByLabelText("Tube")).toBeInTheDocument();
    unmount();
  });
});
