export type MagicNumberEntry = {
  round: number;
  value: number;
  estimated: boolean;
  notes?: string;
};

export const magicNumbers: MagicNumberEntry[] = [
  { round: 0, value: 5412, estimated: true },
  { round: 1, value: 5412, estimated: true },
  { round: 2, value: 5245, estimated: true },
  { round: 3, value: 5075, estimated: true },
  { round: 4, value: 5040, estimated: true },
];