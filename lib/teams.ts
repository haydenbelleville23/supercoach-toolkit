export type Team = {
  code: string;
  name: string;
  shortName: string;
  logo: string;
};

export const TEAMS: Record<string, Team> = {
  ADE: {
    code: "ADE",
    name: "Adelaide Crows",
    shortName: "Adelaide",
    logo: "/teams/ade.png",
  },
  BRI: {
    code: "BRI",
    name: "Brisbane Lions",
    shortName: "Brisbane",
    logo: "/teams/bri.png",
  },
  CAR: {
    code: "CAR",
    name: "Carlton",
    shortName: "Carlton",
    logo: "/teams/car.png",
  },

  // We'll add the remaining clubs next.
};

export function getTeam(code: string): Team | undefined {
  return TEAMS[code];
}

export function getTeamLogo(code: string): string {
  return getTeam(code)?.logo ?? "/teams/unknown.png";
}