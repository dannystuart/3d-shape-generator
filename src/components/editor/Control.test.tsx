import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SPEC } from "@/engine/spec";
import { Control } from "./Control";

describe("Control", () => {
  it("draws a slider for a number, with its label", () => {
    render(<Control name="roughness" spec={DEFAULT_SPEC} baseline={DEFAULT_SPEC} onChange={() => {}} />);
    expect(screen.getByLabelText("Roughness")).toBeInTheDocument();
  });

  it("draws a colour well that carries the spec's colour and reports a change", () => {
    const onChange = vi.fn();
    render(<Control name="color" spec={DEFAULT_SPEC} baseline={DEFAULT_SPEC} onChange={onChange} />);
    const input = screen.getByLabelText("Colour") as HTMLInputElement;
    expect(input.value).toBe(DEFAULT_SPEC.color);
    fireEvent.input(input, { target: { value: "#ff0000" } });
    expect(onChange).toHaveBeenCalledWith({ color: "#ff0000" });
  });

  it("names a dial from the shape catalogue, and draws nothing when the shape has no such dial", () => {
    const torus = { ...DEFAULT_SPEC, shape: "torus" };
    render(<Control name="shapeA" spec={torus} baseline={torus} onChange={() => {}} />);
    expect(screen.getByLabelText("Tube")).toBeInTheDocument();
    const { container } = render(<Control name="shapeA" spec={DEFAULT_SPEC} baseline={DEFAULT_SPEC} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names an effect dial from the effect catalogue", () => {
    const halftone = { ...DEFAULT_SPEC, effect: "halftone" as const };
    render(<Control name="effectA" spec={halftone} baseline={halftone} onChange={() => {}} />);
    expect(screen.getByLabelText("Dot size")).toBeInTheDocument();
  });

  it("draws nothing for pickers, pads and hidden data", () => {
    for (const name of ["shape", "keyX", "svg"] as const) {
      const { container } = render(<Control name={name} spec={DEFAULT_SPEC} baseline={DEFAULT_SPEC} onChange={() => {}} />);
      expect(container).toBeEmptyDOMElement();
    }
  });
});
