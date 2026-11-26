/** Canonical columns of the weekly list. */
export type ListColumn = "player" | "team" | "injury" | "return" | "selected" | "status";

const HEADER_NAMES: Record<ListColumn, string[]> = {
  player: ["player", "name", "player name"],
  team: ["team", "club"],
  injury: ["injury", "reason"],
  return: ["estimated return", "est return", "est. return", "return", "expected return"],
  selected: ["selected", "named"],
  status: ["status", "status override", "override"],
};

const REQUIRED: ListColumn[] = ["player", "team", "injury", "return"];

export interface ListRow {
  /** 1-based line number in the file, for messages. */
  line: number;
  player: string;
  team: string;
  injury: string;
  return: string;
  selected: string;
  status: string;
}

export type ParseResult =
  | { ok: true; rows: ListRow[]; delimiter: string }
  | { ok: false; errors: string[] };

/** Splits one line, honouring "quoted, fields" with "" escapes. */
function splitLine(line: string, delimiter: string): string[] {
  if (delimiter !== ",") {
    return line.split(delimiter).map((cell) => cell.trim());
  }

  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }

  cells.push(cell.trim());
  return cells;
}

const headerKey = (text: string) => text.toLowerCase().replace(/[^a-z. ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Reads the weekly list: CSV, or text pasted from a table (tab- or
 * pipe-separated). Lines starting with "#" and blank lines are skipped.
 * The first remaining line is the header; columns can be in any order.
 */
export function parseAvailabilityTable(text: string): ParseResult {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((content, index) => ({ content, line: index + 1 }))
    .filter(({ content }) => content.trim() !== "" && !content.trim().startsWith("#"));

  if (lines.length === 0) {
    return { ok: false, errors: ["The file is empty."] };
  }

  const head = lines[0].content;
  const delimiter = head.includes("\t") ? "\t" : head.includes("|") ? "|" : ",";
  const headers = splitLine(head, delimiter).map(headerKey);

  const index = {} as Record<ListColumn, number>;
  for (const column of Object.keys(HEADER_NAMES) as ListColumn[]) {
    index[column] = headers.findIndex((h) => HEADER_NAMES[column].includes(h));
  }

  const missing = REQUIRED.filter((column) => index[column] === -1);
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [
        `Missing column(s): ${missing.join(", ")}. Found: ${headers.join(", ")}. ` +
          "Expected: player, team, injury, estimated return, and optionally selected and status.",
      ],
    };
  }

  const cell = (cells: string[], column: ListColumn) =>
    index[column] === -1 ? "" : (cells[index[column]] ?? "").trim();

  const rows = lines.slice(1).map(({ content, line }) => {
    const cells = splitLine(content, delimiter);
    return {
      line,
      player: cell(cells, "player"),
      team: cell(cells, "team"),
      injury: cell(cells, "injury"),
      return: cell(cells, "return"),
      selected: cell(cells, "selected"),
      status: cell(cells, "status"),
    };
  });

  return { ok: true, rows, delimiter };
}

/** "yes"/"no"/blank to true/false/null; undefined for anything else. */
export function parseSelected(text: string): boolean | null | undefined {
  const t = text.trim().toLowerCase();
  if (t === "") return null;
  if (["yes", "y", "true", "1", "named", "selected"].includes(t)) return true;
  if (["no", "n", "false", "0", "omitted", "not selected"].includes(t)) return false;
  return undefined;
}
