import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CardLayoutToggle } from "./card-layout-toggle";
import { columnsFor } from "./session-grid";

describe("CardLayoutToggle", () => {
  afterEach(cleanup);

  it("marks the current size and reports a new pick", () => {
    const onChange = vi.fn();
    render(<CardLayoutToggle value="medium" onChange={onChange} />);

    expect(screen.getByRole("radio", { name: "Medium cards" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(screen.getByRole("radio", { name: "Small cards" }));
    expect(onChange).toHaveBeenCalledWith("small");
  });

  it("keeps the current size when the active option is clicked again", () => {
    const onChange = vi.fn();
    render(<CardLayoutToggle value="large" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "Large cards" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("columnsFor", () => {
  it("fits as many minimum-width tiles as the row allows", () => {
    // 4 x 180px tiles + 3 x 16px gaps = 768px.
    expect(columnsFor(768, 180)).toBe(4);
    expect(columnsFor(767, 180)).toBe(3);
  });

  it("never drops below one column", () => {
    expect(columnsFor(0, 560)).toBe(1);
    expect(columnsFor(320, 560)).toBe(1);
  });
});
