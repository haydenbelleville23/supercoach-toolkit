export function summarise(results: ValidationResult[]) {
  const differences = results.map((r) =>
    Math.abs(r.difference),
  );

  return {
    players: results.length,

    averageError:
      differences.reduce(
        (a, b) => a + b,
        0,
      ) / differences.length,

    worstError: Math.max(...differences),

    bestError: Math.min(...differences),
  };
}