import { describe, expect, it } from "vitest";

import { shortPlayerName } from "@/lib/players/shortName";

describe("shortPlayerName", () => {
  it("uses the first initial and surname", () => {
    expect(shortPlayerName("Max Gawn")).toBe("M. Gawn");
  });

  it("keeps compound surnames whole", () => {
    expect(shortPlayerName("Jordan De Goey")).toBe("J. De Goey");
    expect(shortPlayerName("Jye van Rooyen")).toBe("J. van Rooyen");
    expect(shortPlayerName("Callum O'Brien")).toBe("C. O'Brien");
    expect(shortPlayerName("Josh Ugle-Hagan")).toBe("J. Ugle-Hagan");
  });

  it("returns a single name unchanged", () => {
    expect(shortPlayerName("Heathen")).toBe("Heathen");
    expect(shortPlayerName("  Heathen ")).toBe("Heathen");
    expect(shortPlayerName("")).toBe("");
  });

  it("tidies spacing and capitalises the initial", () => {
    expect(shortPlayerName("  max   Gawn ")).toBe("M. Gawn");
  });

  it("gives players who share a short name the same result", () => {
    // Told apart by the team badge and the full name in the title.
    expect(shortPlayerName("Jack Henry")).toBe("J. Henry");
    expect(shortPlayerName("James Henry")).toBe("J. Henry");
  });

  it("matches every real player's name to a non-empty short form", async () => {
    const { getPlayers } = await import("@/lib/players");
    for (const player of getPlayers()) {
      const short = shortPlayerName(player.name);
      expect(short.length).toBeGreaterThan(0);
      expect(short.length).toBeLessThanOrEqual(player.name.length);
    }
  });
});
