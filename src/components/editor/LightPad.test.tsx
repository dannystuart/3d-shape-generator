import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LightPad } from "./LightPad";

function padAt(width = 200, height = 100) {
  const pad = screen.getByLabelText("Light position");
  pad.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0, toJSON() {} });
  return pad;
}

describe("LightPad", () => {
  it("reads the centre as 0,0 and the top-right corner as 1,1", () => {
    const onChange = vi.fn();
    render(<LightPad x={0.3} y={0.3} onChange={onChange} />);
    const pad = padAt();
    fireEvent.pointerDown(pad, { clientX: 100, clientY: 50, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith({ keyX: 0, keyY: 0 });
    fireEvent.pointerDown(pad, { clientX: 200, clientY: 0, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith({ keyX: 1, keyY: 1 });
  });

  it("nudges with the arrow keys", () => {
    const onChange = vi.fn();
    render(<LightPad x={0} y={0} onChange={onChange} />);
    fireEvent.keyDown(screen.getByLabelText("Light position"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith({ keyX: 0.05, keyY: 0 });
  });
});
