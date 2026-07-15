export type ValidationResult = {
  id: number;
  name: string;

  officialPrice: number;
  enginePrice: number;

  difference: number;

  officialMagicNumber: number;
  estimatedMagicNumber: number;
};