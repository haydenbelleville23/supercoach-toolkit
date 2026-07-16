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
  BRL: {
    code: "BRL",
    name: "Brisbane Lions",
    shortName: "Brisbane",
    logo: "/teams/brl.png",
  },
  CAR: {
    code: "CAR",
    name: "Carlton",
    shortName: "Carlton",
    logo: "/teams/car.png",
  },
  COL: {
    code: "COL",
    name: "Collingwood",
    shortName: "Collingwood",
    logo: "/teams/col.png",
  },
  ESS: {
    code: "ESS",
    name: "Essendon",
    shortName: "Essendon",
    logo: "/teams/ess.png",
  },
  FRE: {
    code: "FRE",
    name: "Fremantle",
    shortName: "Fremantle",
    logo: "/teams/fre.png",
  },
  GEE: {
    code: "GEE",
    name: "Geelong",
    shortName: "Geelong",
    logo: "/teams/gee.png",
  },
  GCS: {
    code: "GCS",
    name: "Gold Coast",
    shortName: "Gold Coast",
    logo: "/teams/gcs.png",
  },
  GWS: {
    code: "GWS",
    name: "GWS Giants",
    shortName: "GWS",
    logo: "/teams/gws.png",
  },
  HAW: {
    code: "HAW",
    name: "Hawthorn",
    shortName: "Hawthorn",
    logo: "/teams/haw.png",
  },
  MEL: {
    code: "MEL",
    name: "Melbourne",
    shortName: "Melbourne",
    logo: "/teams/mel.png",
  },
  NTH: {
    code: "NTH",
    name: "North Melbourne",
    shortName: "North",
    logo: "/teams/nth.png",
  },
  PTA: {
    code: "PTA",
    name: "Port Adelaide",
    shortName: "Port",
    logo: "/teams/pta.png",
  },
  RIC: {
    code: "RIC",
    name: "Richmond",
    shortName: "Richmond",
    logo: "/teams/ric.png",
  },
  STK: {
    code: "STK",
    name: "St Kilda",
    shortName: "St Kilda",
    logo: "/teams/stk.png",
  },
  SYD: {
    code: "SYD",
    name: "Sydney",
    shortName: "Sydney",
    logo: "/teams/syd.png",
  },
  WBD: {
    code: "WBD",
    name: "Western Bulldogs",
    shortName: "Bulldogs",
    logo: "/teams/wbd.png",
  },
  WCE: {
    code: "WCE",
    name: "West Coast",
    shortName: "West Coast",
    logo: "/teams/wce.png",
  },
};

export function getTeam(code: string): Team | undefined {
  return TEAMS[code.toUpperCase()];
}

export function getTeamLogo(code: string): string {
  return getTeam(code)?.logo ?? "/teams/unknown.png";
}