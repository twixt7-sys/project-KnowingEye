import { useQuery, useQueryClient } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProfileUser } from "@/core/config/api";
import { tokenStore } from "@/core/config/api";
import { AuthProvider, useAuth } from "./auth-provider";
import { QueryProvider } from "./query-provider";

const api = vi.hoisted(() => ({
  login: vi.fn(),
  getProfile: vi.fn(),
  getAccessMap: vi.fn(),
  fetchMyExams: vi.fn(),
}));

vi.mock("@/core/config/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/config/api")>();
  return { ...actual, apiClient: api };
});

function profile(id: number, username: string): ProfileUser {
  return {
    id,
    username,
    email: `${username}@example.test`,
    first_name: username,
    last_name: "Examinee",
    role: "STUDENT",
  } as ProfileUser;
}

const alice = profile(1, "alice");
const bob = profile(2, "bob");

/** Whoever the server thinks is signed in, keyed by the access token login() stored. */
const accounts: Record<string, ProfileUser> = { alice, bob };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let client: ReturnType<typeof useQueryClient>;
let auth: ReturnType<typeof useAuth>;

/** Stand-in for any per-user screen: one query keyed only by the endpoint, like the real exam list. */
function MyExams() {
  auth = useAuth();
  client = useQueryClient();
  const { data } = useQuery({
    queryKey: ["dashboard", "student-exams"],
    queryFn: () => api.fetchMyExams(),
    enabled: !!auth.user,
  });
  if (!auth.user) return <p>signed out</p>;
  return (
    <ul aria-label={`exams for ${auth.user.username}`}>
      {(data ?? []).map((title: string) => (
        <li key={title}>{title}</li>
      ))}
    </ul>
  );
}

function renderApp() {
  return render(
    <QueryProvider>
      <AuthProvider>
        <MyExams />
      </AuthProvider>
    </QueryProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  api.login.mockReset().mockImplementation(async ({ username }: { username: string }) => {
    tokenStore.set(username, `${username}-refresh`);
  });
  api.getProfile.mockReset().mockImplementation(async () => accounts[tokenStore.access ?? ""]);
  api.getAccessMap.mockReset().mockResolvedValue({ role: "STUDENT", modules: [], permissions: [] });
  api.fetchMyExams.mockReset();
});

afterEach(() => {
  cleanup(); // vitest `globals` is off, so RTL does not auto-clean
  localStorage.clear();
});

async function signInAsAliceWithCachedExams() {
  api.fetchMyExams.mockResolvedValueOnce(["Alice's private retake"]);
  renderApp();
  await screen.findByText("signed out");
  await act(() => auth.login("alice", "pw"));
  await screen.findByText("Alice's private retake");
}

describe("AuthProvider query cache isolation", () => {
  it("does not show user A's cached data to user B after logout + login in the same tab", async () => {
    await signInAsAliceWithCachedExams();

    act(() => auth.logout());
    await screen.findByText("signed out");
    // The still-mounted (now disabled) observer may re-create an empty entry; no data survives.
    expect(client.getQueryCache().getAll().map((q) => q.state.data)).toEqual(
      expect.not.arrayContaining([expect.anything()]),
    );

    // Bob's request is still in flight; without the clear, Alice's (still
    // fresh, staleTime 30s) list would render here and no refetch would run.
    const bobsExams = deferred<string[]>();
    api.fetchMyExams.mockReturnValueOnce(bobsExams.promise);
    await act(() => auth.login("bob", "pw"));

    expect(screen.getByLabelText("exams for bob")).toBeInTheDocument();
    expect(screen.queryByText("Alice's private retake")).not.toBeInTheDocument();
    expect(api.fetchMyExams).toHaveBeenCalledTimes(2);

    await act(async () => bobsExams.resolve(["Bob's midterm"]));
    await screen.findByText("Bob's midterm");
    expect(screen.queryByText("Alice's private retake")).not.toBeInTheDocument();
  });

  it("drops the cache when a different user signs in without logging out first", async () => {
    await signInAsAliceWithCachedExams();

    const bobsExams = deferred<string[]>();
    api.fetchMyExams.mockReturnValueOnce(bobsExams.promise);
    await act(() => auth.login("bob", "pw"));

    expect(screen.getByLabelText("exams for bob")).toBeInTheDocument();
    expect(screen.queryByText("Alice's private retake")).not.toBeInTheDocument();

    await act(async () => bobsExams.resolve(["Bob's midterm"]));
    await waitFor(() => expect(screen.getByText("Bob's midterm")).toBeInTheDocument());
  });

  it("keeps the cache when the same user's profile is refreshed", async () => {
    await signInAsAliceWithCachedExams();

    await act(() => auth.refresh());

    expect(screen.getByText("Alice's private retake")).toBeInTheDocument();
    expect(api.fetchMyExams).toHaveBeenCalledTimes(1);
  });
});
