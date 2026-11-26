// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DataTable, { type DataTableColumn } from "@/components/ui/DataTable";
import PlayerCell from "@/components/ui/PlayerCell";

type Row = { id: number; name: string; price: number | null };

const rows: Row[] = [
  { id: 1, name: "Max Gawn", price: 900_000 },
  { id: 2, name: "Brodie Grundy", price: 750_000 },
  { id: 3, name: "Tim English", price: null },
];

const columns: DataTableColumn<Row>[] = [
  {
    id: "name",
    header: "Player",
    cell: (r) => r.name,
    width: { base: 124, sm: 160 },
    sortValue: (r) => r.name,
    firstSortDirection: "asc",
  },
  {
    id: "price",
    header: "Price",
    cell: (r) => r.price ?? "-",
    width: 84,
    align: "right",
    sortValue: (r) => r.price,
  },
  { id: "note", header: "Note", cell: () => "x", width: 60, hideBelow: "sm" },
];

const firstColumnText = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

afterEach(cleanup);

describe("DataTable", () => {
  it("sorts from header buttons and sets aria-sort", () => {
    render(<DataTable rows={rows} columns={columns} rowKey={(r) => r.id} caption="Test" />);

    const priceHeader = screen.getByRole("columnheader", { name: /price/i });
    const nameHeader = screen.getByRole("columnheader", { name: /player/i });
    const noteHeader = screen.getByRole("columnheader", { name: /note/i });

    expect(priceHeader).toHaveAttribute("aria-sort", "none");
    expect(noteHeader).not.toHaveAttribute("aria-sort");
    expect(within(noteHeader).queryByRole("button")).toBeNull();

    fireEvent.click(within(priceHeader).getByRole("button"));
    expect(priceHeader).toHaveAttribute("aria-sort", "descending");
    expect(firstColumnText()).toEqual(["Max Gawn", "Brodie Grundy", "Tim English"]);

    fireEvent.click(within(priceHeader).getByRole("button"));
    expect(priceHeader).toHaveAttribute("aria-sort", "ascending");
    // Missing prices stay last.
    expect(firstColumnText()).toEqual(["Brodie Grundy", "Max Gawn", "Tim English"]);

    fireEvent.click(within(nameHeader).getByRole("button"));
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    expect(priceHeader).toHaveAttribute("aria-sort", "none");
    expect(firstColumnText()).toEqual(["Brodie Grundy", "Max Gawn", "Tim English"]);
  });

  it("with manualSorting, reports the sort but leaves row order to the parent", () => {
    const onSortChange = vi.fn();

    render(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        caption="Test"
        sort={{ columnId: "price", direction: "desc" }}
        onSortChange={onSortChange}
        manualSorting
      />,
    );

    const priceHeader = screen.getByRole("columnheader", { name: /price/i });

    expect(firstColumnText()).toEqual(["Max Gawn", "Brodie Grundy", "Tim English"]);
    fireEvent.click(within(priceHeader).getByRole("button"));
    expect(onSortChange).toHaveBeenCalledWith({ columnId: "price", direction: "asc" });
    // Controlled: nothing changes until the parent passes a new sort.
    expect(priceHeader).toHaveAttribute("aria-sort", "descending");
  });

  it("highlights rows", () => {
    render(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        caption="Test"
        highlightRow={(r) => r.id === 2}
      />,
    );

    const highlighted = screen
      .getAllByRole("row")
      .filter((row) => row.hasAttribute("data-highlighted"));

    expect(highlighted).toHaveLength(1);

    const firstCell = within(highlighted[0]).getAllByRole("cell")[0];
    expect(firstCell).toHaveTextContent("Brodie Grundy");
    expect(firstCell.className).toContain("before:bg-brand-green");
    expect(firstCell.className).toContain("bg-[var(--dt-highlight-bg)]");
  });

  it("mutes rows and tightens cells on phones when asked", () => {
    render(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        caption="Test"
        mutedRow={(r) => r.id === 3}
        highlightRow={(r) => r.id === 1}
        compact
      />,
    );

    const muted = screen.getAllByRole("row").filter((row) => row.hasAttribute("data-muted"));
    expect(muted).toHaveLength(1);
    expect(within(muted[0]).getAllByRole("cell")[0]).toHaveTextContent("Tim English");
    expect(within(muted[0]).getAllByRole("cell")[0].className).toContain("bg-[var(--dt-muted-bg)]");

    // Highlighting wins over muting.
    const highlighted = screen.getAllByRole("row").find((row) => row.hasAttribute("data-highlighted"))!;
    expect(highlighted).not.toHaveAttribute("data-muted");

    expect(screen.getByRole("table").className).toContain("text-xs sm:text-sm");
    expect(screen.getAllByRole("columnheader")[0].className).toContain("px-1 sm:px-2");
  });

  it("shows the empty state", () => {
    render(
      <DataTable
        rows={[]}
        columns={columns}
        rowKey={(r) => r.id}
        caption="Test"
        empty="No players match."
      />,
    );

    const cell = screen.getByText("No players match.").closest("td");
    expect(cell).toHaveAttribute("colspan", "3");
    expect(screen.getByText("No players match.").className).toContain("sticky");
  });

  it("makes the header row and first column sticky, and can turn both off", () => {
    const { rerender } = render(
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} caption="Test" />,
    );

    const [corner, header] = screen.getAllByRole("columnheader");
    expect(corner.className).toMatch(/(^| )sticky( |$)/);
    expect(corner.className).toMatch(/(^| )z-30( |$)/);
    expect(header.className).toMatch(/(^| )sticky( |$)/);
    expect(header.className).toMatch(/(^| )z-20( |$)/);

    const firstCell = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0];
    expect(firstCell.className).toMatch(/(^| )sticky( |$)/);
    expect(firstCell.className).toMatch(/(^| )z-10( |$)/);

    expect(screen.getByTestId("data-table-box").className).toContain("dt-viewport");

    rerender(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        caption="Test"
        stickyHeader={false}
        stickyFirstColumn={false}
        fitToViewport={false}
      />,
    );

    expect(screen.getAllByRole("columnheader")[1].className).not.toMatch(/(^| )sticky( |$)/);
    expect(
      within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0].className,
    ).not.toMatch(/(^| )sticky( |$)/);
    expect(screen.getByTestId("data-table-box").className).not.toContain("dt-viewport");
  });

  it("pins an extra column from sm up and hides columns below a breakpoint", () => {
    const pinned: DataTableColumn<Row>[] = [
      columns[0],
      { ...columns[1], pinFrom: "sm" },
      columns[2],
    ];

    render(<DataTable rows={rows} columns={pinned} rowKey={(r) => r.id} caption="Test" />);

    const price = screen.getByRole("columnheader", { name: /price/i });
    expect(price.className).toContain("sm:sticky");
    expect(price.style.getPropertyValue("--dt-left-sm")).toBe("160px");
    expect(screen.getByRole("columnheader", { name: /note/i }).className).toContain(
      "hidden sm:table-cell",
    );
  });

  it("calls onNearEnd when scrolled near the end", () => {
    const onNearEnd = vi.fn();

    render(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        caption="Test"
        onNearEnd={onNearEnd}
      />,
    );

    const box = screen.getByTestId("data-table-box");
    Object.defineProperties(box, {
      scrollHeight: { value: 2000, configurable: true },
      clientHeight: { value: 500, configurable: true },
      scrollTop: { value: 100, configurable: true, writable: true },
    });

    fireEvent.scroll(box);
    expect(onNearEnd).not.toHaveBeenCalled();

    box.scrollTop = 1300;
    fireEvent.scroll(box);
    expect(onNearEnd).toHaveBeenCalledTimes(1);
  });

  it("shows a screen-bottom scrollbar only while the box's own is off screen, synced both ways", () => {
    let onVisibility: (entries: { isIntersecting: boolean }[]) => void = () => {};

    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof onVisibility) {
          onVisibility = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );

    // A table wider than its box.
    const scrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => 1000 });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 300 });

    try {
      render(<DataTable rows={rows} columns={columns} rowKey={(r) => r.id} caption="Test" />);

      const box = screen.getByTestId("data-table-box");
      const proxy = screen.getByTestId("data-table-scrollbar");

      // The box's bottom edge is on screen: no extra scrollbar.
      act(() => onVisibility([{ isIntersecting: true }]));
      expect(proxy.className).toMatch(/(^| )hidden( |$)/);

      // Below the fold: the sticky scrollbar appears.
      act(() => onVisibility([{ isIntersecting: false }]));
      expect(proxy.className).not.toMatch(/(^| )hidden( |$)/);
      expect(proxy.className).toContain("sticky bottom-0");
      expect(proxy.firstElementChild).toHaveStyle({ width: "1000px" });

      box.scrollLeft = 120;
      fireEvent.scroll(box);
      expect(proxy.scrollLeft).toBe(120);

      proxy.scrollLeft = 300;
      fireEvent.scroll(proxy);
      expect(box.scrollLeft).toBe(300);
    } finally {
      if (scrollWidth) Object.defineProperty(HTMLElement.prototype, "scrollWidth", scrollWidth);
      if (clientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidth);
      vi.unstubAllGlobals();
    }
  });

  it("renders an expanded row under a row", () => {
    render(
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        caption="Test"
        renderExpanded={(r) => (r.id === 1 ? <p>Quick scores</p> : null)}
      />,
    );

    expect(screen.getByText("Quick scores").closest("td")).toHaveAttribute("colspan", "3");
    expect(screen.getAllByRole("row")).toHaveLength(1 + rows.length + 1);
  });
});

describe("PlayerCell", () => {
  it("shows the short and full names and team; positions in the tooltip", () => {
    render(
      <PlayerCell
        name="Jordan De Goey"
        team="COL"
        positions={["MID", "FWD"]}
        href="/projector?player=1"
      />,
    );

    const link = screen.getByRole("link", { name: "Jordan De Goey" });
    expect(link).toHaveAttribute("title", "Jordan De Goey · COL · MID/FWD");
    expect(link).toHaveAttribute("href", "/projector?player=1");
    expect(within(link).getByText("J. De Goey").className).toContain("sm:hidden");
    expect(within(link).getByText("Jordan De Goey").className).toContain("hidden sm:inline");
    expect(screen.getByText("COL")).toBeInTheDocument();
    expect(screen.queryByText("MID/FWD")).toBeNull();
  });
});
