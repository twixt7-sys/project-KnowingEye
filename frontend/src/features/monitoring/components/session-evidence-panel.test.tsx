import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionSnapshotRow } from "@/shared/types/api";

const fetchSessionSnapshots = vi.fn();
const fetchSnapshotImageSrc = vi.fn();

vi.mock("@/features/monitoring/api/monitoring-api", () => ({
  fetchSessionSnapshots: (...args: unknown[]) => fetchSessionSnapshots(...args),
  fetchSnapshotImageSrc: (...args: unknown[]) => fetchSnapshotImageSrc(...args),
}));

import { SessionEvidencePanel } from "./session-evidence-panel";

afterEach(cleanup); // vitest `globals` is off, so RTL does not auto-clean

const snap = (over: Partial<SessionSnapshotRow>): SessionSnapshotRow => ({
  id: "s1",
  session: "sess-1",
  user: 7,
  student: "ada",
  exam: 3,
  exam_title: "Logic 101",
  kind: "warning",
  alert: "a1",
  alert_type: "no_face",
  alert_severity: "high",
  alert_message: "No face in frame",
  session_log: null,
  label: "no_face",
  flags: ["no_face"],
  width: 480,
  height: 360,
  captured_at: "2026-10-19T10:00:00Z",
  image_url: "/api/monitoring/snapshots/s1/image/",
  ...over,
});

const renderPanel = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SessionEvidencePanel sessionId="sess-1" />
    </QueryClientProvider>,
  );
};

describe("SessionEvidencePanel", () => {
  beforeEach(() => {
    fetchSessionSnapshots.mockReset();
    fetchSnapshotImageSrc.mockReset();
    fetchSnapshotImageSrc.mockResolvedValue("data:image/jpeg;base64,AAAA");
  });

  it("separates warning frames from the frames kept at termination", async () => {
    fetchSessionSnapshots.mockResolvedValue([
      snap({ id: "w1" }),
      ...[1, 2, 3, 4, 5].map((n) =>
        snap({
          id: `t${n}`,
          kind: "termination",
          alert: null,
          alert_type: null,
          alert_message: null,
          alert_severity: null,
          session_log: 9,
          label: "termination",
          flags: [],
        }),
      ),
    ]);

    renderPanel();

    expect(await screen.findByRole("heading", { name: "Warnings (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Before termination (5)" })).toBeInTheDocument();
    expect(fetchSessionSnapshots).toHaveBeenCalledWith("sess-1");
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(6));
  });

  it("opens a snapshot with the alert it belongs to", async () => {
    fetchSessionSnapshots.mockResolvedValue([snap({ id: "w1", flags: ["no_face", "looking_away"] })]);

    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /no face, looking away/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Warning: no face")).toBeInTheDocument();
    expect(within(dialog).getByText(/No face in frame/)).toBeInTheDocument();
    expect(within(dialog).getByText(/ada · Logic 101/)).toBeInTheDocument();
  });

  it("says so when nothing has been saved yet", async () => {
    fetchSessionSnapshots.mockResolvedValue([]);

    renderPanel();

    expect(await screen.findByText(/No snapshots yet/)).toBeInTheDocument();
  });

  it("reports a load failure instead of showing an empty state", async () => {
    fetchSessionSnapshots.mockRejectedValue(new Error("403"));

    renderPanel();

    expect(await screen.findByText(/Could not load the evidence snapshots/)).toBeInTheDocument();
    expect(screen.queryByText(/No snapshots yet/)).not.toBeInTheDocument();
  });

  it("marks an image that cannot be fetched without breaking the rest", async () => {
    fetchSessionSnapshots.mockResolvedValue([snap({ id: "w1" })]);
    fetchSnapshotImageSrc.mockRejectedValue(new Error("gone"));

    renderPanel();

    expect(await screen.findByText("Unavailable")).toBeInTheDocument();
  });
});
