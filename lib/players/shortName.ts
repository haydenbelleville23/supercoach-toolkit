/**
 * A compact player name for narrow table columns: the first initial plus
 * the surname, e.g. "Max Gawn" -> "M. Gawn".
 *
 * The surname is everything after the first name, so compound surnames
 * stay whole ("Jordan De Goey" -> "J. De Goey", "Jye van Rooyen" ->
 * "J. van Rooyen"). Apostrophes and hyphens are kept ("O'Brien").
 * A single name (no first name) is returned unchanged.
 *
 * Two players can share a short name (for example two "J. Henry"s);
 * PlayerCell tells them apart with the team badge and the full name in its
 * title and accessible label.
 */
export function shortPlayerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    return parts.join(" ");
  }

  const [first, ...surname] = parts;

  return `${first.charAt(0).toUpperCase()}. ${surname.join(" ")}`;
}
