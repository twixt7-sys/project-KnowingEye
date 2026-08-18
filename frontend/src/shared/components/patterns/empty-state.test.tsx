import { render, screen } from "@testing-library/react";
import { Inbox } from "@/shared/icons";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No exams yet"
        description="Create your first exam to get started."
      />
    );

    expect(screen.getByRole("heading", { name: "No exams yet" })).toBeInTheDocument();
    expect(
      screen.getByText("Create your first exam to get started.")
    ).toBeInTheDocument();
  });

  it("renders optional action", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No results"
        action={<button type="button">Create exam</button>}
      />
    );

    expect(screen.getByRole("button", { name: "Create exam" })).toBeInTheDocument();
  });
});
