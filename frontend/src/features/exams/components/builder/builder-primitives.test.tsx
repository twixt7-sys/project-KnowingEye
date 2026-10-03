import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { DepartmentChecklist } from "@/features/exams/components/builder/builder-primitives";

afterEach(cleanup);

const DEPARTMENTS = [
  { id: 1, name: "Computer Science", abbreviation: "CS" },
  { id: 2, name: "Engineering", abbreviation: "ENG" },
  { id: 3, name: "Nursing", abbreviation: "NUR" },
];

function Harness({ initial = [], lockedId }: { initial?: number[]; lockedId?: number }) {
  const [value, setValue] = useState<number[]>(initial);
  return (
    <>
      <DepartmentChecklist
        departments={DEPARTMENTS}
        value={value}
        onChange={setValue}
        lockedId={lockedId}
      />
      <output data-testid="value">{[...value].sort().join(",")}</output>
    </>
  );
}

const selected = () => screen.getByTestId("value").textContent;

describe("DepartmentChecklist", () => {
  it("Select all checks every department", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(selected()).toBe("1,2,3");
    expect(screen.getAllByRole("checkbox").every((c) => c.getAttribute("aria-checked") === "true")).toBe(true);
  });

  it("flips to Clear all once everything is selected, and clears again", () => {
    render(<Harness initial={[1, 2, 3]} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(selected()).toBe("");
    expect(screen.getByRole("button", { name: "Select all" })).toBeTruthy();
  });

  it("keeps the locked home department checked and selected when clearing", () => {
    render(<Harness initial={[2]} lockedId={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(selected()).toBe("1,2,3");
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(selected()).toBe("2");
  });

  it("shows the locked department as checked and disabled even when not in the value", () => {
    render(<Harness lockedId={3} />);
    const nursing = screen.getByTitle("Nursing").querySelector('[role="checkbox"]');
    expect(nursing?.getAttribute("aria-checked")).toBe("true");
    expect(nursing?.hasAttribute("disabled")).toBe(true);
  });
});
