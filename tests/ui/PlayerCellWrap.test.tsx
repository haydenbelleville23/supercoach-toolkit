// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PlayerCell from "@/components/ui/PlayerCell";

afterEach(cleanup);

const LONG_NAMES = ["Christopher Scerri", "Christian Petracca", "Samuel Cumming", "Luke Davies-Uniacke"];

describe("PlayerCell name wrapping", () => {
  it.each(LONG_NAMES)("never truncates %s: it wraps at spaces and hyphens", (name) => {
    render(<PlayerCell name={name} team="MEL" positions={["MID"]} href="/projector?player=1" />);
    const link = screen.getByRole("link", { name });

    // The full name is the accessible label and is in the DOM in full.
    expect(link).toHaveAccessibleName(name);
    expect(link).toHaveTextContent(name);
    // Wraps (undoes the table's nowrap) and has no ellipsis styling.
    expect(link.className).toContain("whitespace-normal");
    for (const el of [link, ...link.querySelectorAll("*")]) {
      expect(el.className).not.toMatch(/\btruncate\b|text-ellipsis|line-clamp/);
    }
  });

  it("puts the positions and status on the line under the name", () => {
    render(
      <PlayerCell
        name="Christian Petracca"
        team="MEL"
        positions={["MID", "FWD"]}
        href="/projector?player=1"
        trailing={<span>OUT 3w</span>}
      />,
    );

    const name = screen.getByRole("link", { name: "Christian Petracca" });
    const status = screen.getByText("OUT 3w");
    const positions = screen.getByText("MID/FWD");

    // Both are in the second line, a sibling block after the name.
    const secondLine = status.parentElement!;
    expect(secondLine).toBe(positions.parentElement);
    expect(secondLine.previousElementSibling).toBe(name);
    expect(name.contains(status)).toBe(false);
  });

  it("puts a leading control (the watchlist star) before the logo", () => {
    render(
      <PlayerCell
        name="Samuel Cumming"
        team="WBD"
        positions={["MID"]}
        leading={<button type="button">star</button>}
      />,
    );
    const star = screen.getByRole("button", { name: "star" });
    const logo = screen.getByRole("img", { name: "Western Bulldogs" });
    expect(star.compareDocumentPosition(logo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
