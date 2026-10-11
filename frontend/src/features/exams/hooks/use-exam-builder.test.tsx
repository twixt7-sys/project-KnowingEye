import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useExamBuilder } from "./use-exam-builder";

// Only the tab-in-the-URL behaviour is under test, so no query ever runs.
vi.mock("@/features/exams/queries/queries", () => {
  const idle = () => ({ queryKey: ["idle"], queryFn: async () => null, enabled: false });
  return {
    examBuilderQueries: {
      exam: idle,
      questions: idle,
      readiness: idle,
      assignments: idle,
      sections: idle,
    },
  };
});
vi.mock("@/shared/components/common/confirm-dialog", () => ({ useConfirm: () => vi.fn() }));

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

function setup(url: string) {
  const here = { search: "" };
  function LocationProbe() {
    here.search = useLocation().search;
    return null;
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <LocationProbe />
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { here, ...renderHook(() => useExamBuilder(5), { wrapper }) };
}

describe("useExamBuilder - tab in the URL", () => {
  it("opens on the settings tab by default", () => {
    expect(setup("/examiner/exams/5/edit").result.current.tab).toBe("settings");
  });

  it("restores the tab named in the URL", () => {
    expect(setup("/examiner/exams/5/edit?tab=questions").result.current.tab).toBe("questions");
  });

  it("falls back to settings for an unknown tab", () => {
    expect(setup("/examiner/exams/5/edit?tab=nope").result.current.tab).toBe("settings");
  });

  it("writes the chosen tab to the URL", () => {
    const { result, here } = setup("/examiner/exams/5/edit");
    act(() => result.current.setTab("publish"));
    expect(result.current.tab).toBe("publish");
    expect(here.search).toBe("?tab=publish");
  });
});
