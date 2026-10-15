import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ExamTimer, formatTime } from "./exam-timer";

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

describe("formatTime", () => {
  it("formats seconds as HH:MM:SS", () => {
    expect(formatTime(0)).toBe("00:00:00");
    expect(formatTime(61)).toBe("00:01:01");
    expect(formatTime(3725)).toBe("01:02:05");
  });
});

describe("ExamTimer", () => {
  it("shows the remaining time while running", () => {
    render(<ExamTimer seconds={125} />);

    expect(screen.getByRole("timer")).toHaveAccessibleName("Time remaining 00:02:05");
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
  });

  it("says it is paused and keeps showing the frozen time", () => {
    render(<ExamTimer seconds={125} paused />);

    expect(screen.getByRole("timer")).toHaveAccessibleName("Timer paused with 00:02:05 remaining");
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("00:02:05")).toBeInTheDocument();
  });

  it("does not pulse in the last minute when paused (the clock is stopped)", () => {
    const { rerender } = render(<ExamTimer seconds={30} />);
    expect(screen.getByRole("timer")).toHaveClass("animate-pulse");

    rerender(<ExamTimer seconds={30} paused />);
    expect(screen.getByRole("timer")).not.toHaveClass("animate-pulse");
    expect(screen.getByRole("timer")).toHaveAttribute("aria-live", "off");
  });
});
