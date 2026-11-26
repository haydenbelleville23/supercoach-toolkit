"use client";

import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  type UIEvent,
  useState,
} from "react";

import {
  sortRows,
  type SortDirection,
  type SortState,
  type SortValue,
} from "@/lib/table/sortRows";

export type { SortDirection, SortState, SortValue };

/** Pixels, or different widths below and from the sm breakpoint. */
export type ColumnWidth = number | { base: number; sm?: number };

export type DataTableColumn<Row> = {
  id: string;
  header: ReactNode;
  /** Plain-text name, when `header` is not plain text. */
  label?: string;
  cell: (row: Row) => ReactNode;
  width: ColumnWidth;
  /** "right" also uses tabular numbers. Default "left". */
  align?: "left" | "right" | "center";
  /** Makes the header a sort button. */
  sortValue?: (row: Row) => SortValue;
  /** Direction of the first click on this header. Default "desc". */
  firstSortDirection?: SortDirection;
  /** Hidden on screens narrower than this breakpoint. */
  hideBelow?: "sm" | "md";
  /** Pins this column too (after the first), from this breakpoint up. */
  pinFrom?: "base" | "sm";
  /** Extra classes for this column's body cells (e.g. colours). */
  cellClassName?: (row: Row) => string;
};

export type DataTableProps<Row> = {
  rows: readonly Row[];
  columns: readonly DataTableColumn<Row>[];
  rowKey: (row: Row) => string | number;

  /** Controlled sort. Pass null for "no sort". */
  sort?: SortState | null;
  /** Starting sort when uncontrolled. */
  defaultSort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  /** The parent sorts `rows` itself (e.g. before paging); only headers update. */
  manualSorting?: boolean;

  /** Default true. */
  stickyHeader?: boolean;
  /** Default true. */
  stickyFirstColumn?: boolean;
  /** Cap the scroll box at the screen height below the site header. Default true. */
  fitToViewport?: boolean;

  highlightRow?: (row: Row) => boolean;
  /** Called when the box is scrolled near its end (load more rows). */
  onNearEnd?: () => void;
  /** Pixels from the end that count as "near". Default 300. */
  nearEndThreshold?: number;

  /** Read by screen readers only. */
  caption: string;
  empty?: ReactNode;
  /** Content shown in a full-width row under a row, or null. */
  renderExpanded?: (row: Row) => ReactNode | null;

  className?: string;
};

// Literal class names, so Tailwind finds them when scanning this file.
const SHADOW_EDGE = "shadow-[4px_0_6px_-2px_rgba(0,0,0,0.55)]";
const SHADOW_EDGE_SM = "sm:shadow-[4px_0_6px_-2px_rgba(0,0,0,0.55)]";

function widths(width: ColumnWidth): { base: number; sm: number } {
  return typeof width === "number"
    ? { base: width, sm: width }
    : { base: width.base, sm: width.sm ?? width.base };
}

const HIDE_CELL = { sm: "hidden sm:table-cell", md: "hidden md:table-cell" };
const HIDE_COL = { sm: "hidden sm:table-column", md: "hidden md:table-column" };

const ALIGN = {
  left: "text-left",
  right: "text-right tabular-nums",
  center: "text-center",
};

type Layout = {
  pinnedBase: boolean;
  pinnedSm: boolean;
  lastPinnedBase: boolean;
  lastPinnedSm: boolean;
  style: CSSProperties;
};

/**
 * Where each column sits: pinned or not at each breakpoint, and its
 * left offset (sum of the widths of pinned columns before it).
 */
function layoutColumns<Row>(
  columns: readonly DataTableColumn<Row>[],
  stickyFirstColumn: boolean,
): Layout[] {
  let leftBase = 0;
  let leftSm = 0;

  const layouts = columns.map((column, index) => {
    const { base, sm } = widths(column.width);
    const pinnedBase =
      (index === 0 && stickyFirstColumn) || column.pinFrom === "base";
    const pinnedSm = pinnedBase || column.pinFrom === "sm";

    const style = {
      "--dt-left": `${leftBase}px`,
      "--dt-left-sm": `${leftSm}px`,
    } as CSSProperties;

    if (pinnedBase && !column.hideBelow) {
      leftBase += base;
    }

    if (pinnedSm && column.hideBelow !== "md") {
      leftSm += sm;
    }

    return { pinnedBase, pinnedSm, lastPinnedBase: false, lastPinnedSm: false, style };
  });

  let lastBase = -1;
  let lastSm = -1;

  layouts.forEach((layout, index) => {
    if (layout.pinnedBase) lastBase = index;
    if (layout.pinnedSm) lastSm = index;
  });

  if (lastBase >= 0) layouts[lastBase].lastPinnedBase = true;
  if (lastSm >= 0) layouts[lastSm].lastPinnedSm = true;

  return layouts;
}

function pinClasses(layout: Layout): string {
  const classes: string[] = [];

  if (layout.pinnedBase) {
    classes.push("sticky left-[var(--dt-left)] sm:left-[var(--dt-left-sm)]");
  } else if (layout.pinnedSm) {
    classes.push("sm:sticky sm:left-[var(--dt-left-sm)]");
  }

  if (layout.lastPinnedBase) {
    classes.push(SHADOW_EDGE);
    if (!layout.lastPinnedSm) classes.push("sm:shadow-none");
  } else if (layout.lastPinnedSm) {
    classes.push(SHADOW_EDGE_SM);
  }

  return classes.join(" ");
}

/** Sum of visible widths at each breakpoint, for the table's own width. */
function tableWidths<Row>(columns: readonly DataTableColumn<Row>[]) {
  let base = 0;
  let sm = 0;
  let md = 0;

  for (const column of columns) {
    const w = widths(column.width);
    if (!column.hideBelow) base += w.base;
    if (column.hideBelow !== "md") sm += w.sm;
    md += w.sm;
  }

  return { base, sm, md };
}

export default function DataTable<Row>({
  rows,
  columns,
  rowKey,
  sort: controlledSort,
  defaultSort = null,
  onSortChange,
  manualSorting = false,
  stickyHeader = true,
  stickyFirstColumn = true,
  fitToViewport = true,
  highlightRow,
  onNearEnd,
  nearEndThreshold = 300,
  caption,
  empty = "No rows to show.",
  renderExpanded,
  className = "",
}: DataTableProps<Row>) {
  const [internalSort, setInternalSort] = useState<SortState | null>(defaultSort);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;

  const layouts = layoutColumns(columns, stickyFirstColumn);
  const total = tableWidths(columns);
  const pinWidth = (breakpoint: "base" | "sm") =>
    columns.reduce((sum, column, index) => {
      const layout = layouts[index];
      const pinned = breakpoint === "base" ? layout.pinnedBase : layout.pinnedSm;
      return pinned ? sum + widths(column.width)[breakpoint] : sum;
    }, 0);

  const sortColumn = sort ? columns.find((column) => column.id === sort.columnId) : undefined;
  const displayRows =
    manualSorting || !sort || !sortColumn?.sortValue
      ? rows
      : sortRows(rows, sortColumn.sortValue, sort.direction);

  function changeSort(column: DataTableColumn<Row>) {
    const next: SortState =
      sort?.columnId === column.id
        ? { columnId: column.id, direction: sort.direction === "asc" ? "desc" : "asc" }
        : { columnId: column.id, direction: column.firstSortDirection ?? "desc" };

    if (controlledSort === undefined) {
      setInternalSort(next);
    }

    onSortChange?.(next);
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    if (!onNearEnd) return;

    const box = event.currentTarget;
    const remaining = box.scrollHeight - box.scrollTop - box.clientHeight;

    if (remaining <= nearEndThreshold) {
      onNearEnd();
    }
  }

  const boxStyle = {
    "--dt-pin": `${pinWidth("base")}px`,
    "--dt-pin-sm": `${pinWidth("sm")}px`,
  } as CSSProperties;

  const tableStyle = {
    "--dt-w": `${total.base}px`,
    "--dt-w-sm": `${total.sm}px`,
    "--dt-w-md": `${total.md}px`,
  } as CSSProperties;

  return (
    <div
      data-testid="data-table-box"
      onScroll={handleScroll}
      style={boxStyle}
      // scroll-padding keeps a focused cell clear of the pinned columns
      // and the sticky header row when tabbing.
      className={`${fitToViewport ? "dt-viewport overflow-auto" : "overflow-x-auto"} scroll-pt-11 scroll-pl-[var(--dt-pin)] sm:scroll-pl-[var(--dt-pin-sm)] rounded-xl border border-slate-800 bg-[var(--dt-row-bg)] ${className}`}
    >
      <table
        style={tableStyle}
        className="w-[max(100%,var(--dt-w))] table-fixed border-separate border-spacing-0 text-sm sm:w-[max(100%,var(--dt-w-sm))] md:w-[max(100%,var(--dt-w-md))]"
      >
        <caption className="sr-only">{caption}</caption>

        <colgroup>
          {columns.map((column) => {
            const { base, sm } = widths(column.width);
            return (
              <col
                key={column.id}
                style={{ "--dt-col": `${base}px`, "--dt-col-sm": `${sm}px` } as CSSProperties}
                className={`w-[var(--dt-col)] sm:w-[var(--dt-col-sm)] ${column.hideBelow ? HIDE_COL[column.hideBelow] : ""}`}
              />
            );
          })}
        </colgroup>

        <thead>
          <tr>
            {columns.map((column, index) => {
              const layout = layouts[index];
              const pinned = layout.pinnedBase || layout.pinnedSm;
              const align = column.align ?? "left";
              const active = sort?.columnId === column.id;
              const ariaSort = column.sortValue
                ? active
                  ? sort!.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
                : undefined;

              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={ariaSort}
                  style={layout.style}
                  className={[
                    "border-b border-slate-700 bg-[var(--dt-head-bg)] px-2 py-2.5 align-bottom text-xs font-semibold uppercase leading-tight tracking-wide text-slate-400",
                    ALIGN[align],
                    stickyHeader ? "sticky top-0" : "",
                    // Pinned header cells sit above both the header row
                    // and the pinned body cells (the crossing corner).
                    stickyHeader ? (pinned ? "z-30" : "z-20") : pinned ? "z-10" : "",
                    pinClasses(layout),
                    column.hideBelow ? HIDE_CELL[column.hideBelow] : "",
                  ].join(" ")}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => changeSort(column)}
                      className={`inline-flex w-full items-end gap-1 rounded uppercase focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                        align === "right" ? "justify-end text-right" : align === "center" ? "justify-center" : "text-left"
                      } ${active ? "text-white" : "hover:text-slate-200"}`}
                    >
                      <span>{column.header}</span>
                      <span aria-hidden="true" className={`shrink-0 text-[10px] ${active ? "text-brand-green" : "text-slate-600"}`}>
                        {active ? (sort!.direction === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {displayRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          ) : (
            displayRows.map((row) => {
              const highlighted = highlightRow?.(row) ?? false;
              const expanded = renderExpanded?.(row) ?? null;
              const background = highlighted
                ? "bg-[var(--dt-highlight-bg)] group-hover/row:bg-[var(--dt-highlight-hover-bg)]"
                : "bg-[var(--dt-row-bg)] group-hover/row:bg-[var(--dt-row-hover-bg)]";

              return (
                <Fragment key={rowKey(row)}>
                  <tr className="group/row" data-highlighted={highlighted || undefined}>
                    {columns.map((column, index) => {
                      const layout = layouts[index];
                      const pinned = layout.pinnedBase || layout.pinnedSm;

                      return (
                        <td
                          key={column.id}
                          style={layout.style}
                          className={[
                            "whitespace-nowrap border-b border-slate-800 px-2 py-2.5 leading-5",
                            ALIGN[column.align ?? "left"],
                            background,
                            pinned ? "z-10" : "",
                            pinClasses(layout),
                            // Highlighted rows: a brand-green bar on the left edge.
                            index === 0 && highlighted
                              ? `${pinned ? "" : "relative"} before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brand-green`
                              : "",
                            column.hideBelow ? HIDE_CELL[column.hideBelow] : "",
                            column.cellClassName?.(row) ?? "",
                          ].join(" ")}
                        >
                          {column.cell(row)}
                        </td>
                      );
                    })}
                  </tr>

                  {expanded !== null && (
                    <tr>
                      <td colSpan={columns.length} className="border-b border-slate-800 bg-[var(--dt-head-bg)] p-0">
                        {/* Stays in view while the table scrolls sideways. */}
                        <div className="sticky left-0 w-[min(100%,calc(100vw-2rem))] px-3 py-3">
                          {expanded}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
