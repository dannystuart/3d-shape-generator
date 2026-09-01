import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShapePicker } from "./ShapePicker";

describe("ShapePicker", () => {
  it("shows every shape, presses the chosen one, and reports a pick", () => {
    const onPick = vi.fn();
    render(<ShapePicker value="sphere" svg="" onPick={onPick} onUpload={() => {}} onError={() => {}} />);
    expect(screen.getByRole("button", { name: "Sphere" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Torus" }));
    expect(onPick).toHaveBeenCalledWith("torus");
  });

  it("filters by the search query, and by family", () => {
    render(<ShapePicker value="sphere" svg="" onPick={() => {}} onUpload={() => {}} onError={() => {}} query="heart" />);
    expect(screen.getByRole("button", { name: "Heart" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sphere" })).toBeNull();
  });

  it("offers the upload under Yours when there is no upload yet", () => {
    render(<ShapePicker value="sphere" svg="" onPick={() => {}} onUpload={() => {}} onError={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Yours" }));
    expect(screen.getByText(/upload an svg/i)).toBeInTheDocument();
  });
});
