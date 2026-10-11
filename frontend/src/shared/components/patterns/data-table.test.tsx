import type { ColumnDef } from "@tanstack/react-table";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataTable } from "./data-table";
import { TableLoadingRow } from "./loading-state";

type Row = { name: string };

const columns: ColumnDef<Row, unknown>[] = [{ accessorKey: "name", header: "Name" }];

afterEach(cleanup);

describe("DataTable loading state", () => {
  it("shows a spinner row instead of rows or the empty state while loading", () => {
    render(
      <DataTable
        columns={columns}
        data={[{ name: "Ada" }]}
        loading
        loadingLabel="Loading people…"
      />,
    );

    expect(screen.getByText("Loading people…")).toBeTruthy();
    expect(screen.queryByText("Ada")).toBeNull();
    expect(screen.queryByText("No results.")).toBeNull();
  });

  it("renders rows once loading finishes", () => {
    render(<DataTable columns={columns} data={[{ name: "Ada" }]} loading={false} />);

    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
  });
});

describe("TableLoadingRow", () => {
  it("spans the requested number of columns", () => {
    render(
      <table>
        <tbody>
          <TableLoadingRow colSpan={5} label="Loading users…" />
        </tbody>
      </table>,
    );

    expect(screen.getByText("Loading users…").closest("td")?.getAttribute("colspan")).toBe("5");
  });
});
