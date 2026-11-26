// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AvailabilityBadge, { badgeLabel } from "@/components/ui/AvailabilityBadge";
import type { RoundAvailability } from "@/lib/availability/selectors";

const info = (extra: Partial<RoundAvailability>): RoundAvailability => ({
  status: "long-term",
  injury: "Knee",
  returnText: "Season",
  returnWeeks: null,
  returnRound: null,
  selected: null,
  asOf: "2026-05-19",
  source: "Test list",
  round: 11,
  sample: false,
  ...extra,
});

const TODAY = new Date("2026-05-20T00:00:00Z");

afterEach(cleanup);

describe("AvailabilityBadge", () => {
  it("labels each status in text", () => {
    expect(badgeLabel({ status: "long-term", returnWeeks: null })).toBe("INJ");
    expect(badgeLabel({ status: "suspended", returnWeeks: 1 })).toBe("SUS");
    expect(badgeLabel({ status: "test", returnWeeks: null })).toBe("TEST");
    expect(badgeLabel({ status: "short-term", returnWeeks: 2 })).toBe("OUT 2w");
    expect(badgeLabel({ status: "unknown", returnWeeks: null })).toBe("?");
    // Compact (field cards): the weeks move to the details.
    expect(badgeLabel({ status: "short-term", returnWeeks: 2 }, true)).toBe("OUT");
  });

  it("shows nothing for available players or no data", () => {
    const { container } = render(
      <>
        <AvailabilityBadge info={info({ status: "available" })} today={TODAY} />
        <AvailabilityBadge info={null} today={TODAY} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has an icon and a label, and shows the details on tap", () => {
    render(<AvailabilityBadge info={info({ status: "short-term", returnText: "1-2 weeks", returnWeeks: 2, returnRound: 13 })} today={TODAY} />);

    const badge = screen.getByRole("button");
    expect(badge).toHaveTextContent("OUT 2w");
    expect(badge.querySelector("svg")).not.toBeNull();

    fireEvent.click(badge);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Injured (short-term): Knee");
    expect(tip).toHaveTextContent("Return: 1-2 weeks (about Round 13)");
    expect(tip).toHaveTextContent("As of 19 May 2026");
    expect(tip).toHaveTextContent("Source: Test list");
  });

  it("is greyed and says so when stale", () => {
    render(<AvailabilityBadge info={info({})} today={new Date("2026-06-10T00:00:00Z")} />);
    const badge = screen.getByRole("button");
    expect(badge.className).toContain("text-slate-400");
    expect(badge).toHaveAccessibleName(/out of date/);
  });

  it("marks the invented sample", () => {
    render(<AvailabilityBadge info={info({ sample: true })} today={new Date("2026-11-27")} />);
    const badge = screen.getByRole("button");
    expect(badge).toHaveAccessibleName(/Sample status data/);
    expect(badge.className).toContain("border-dashed");
  });
});
