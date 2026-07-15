type ScoreInputsProps = {
  scores: number[];
  onScoreChange: (index: number, value: number) => void;
};

export default function ScoreInputs({
  scores,
  onScoreChange,
}: ScoreInputsProps) {
  return (
    <div>
      <h2 className="mt-8 font-semibold">Projected scores</h2>

      <div className="mt-4 space-y-3">
        {scores.map((score, index) => (
          <label
            className="flex items-center justify-between gap-4"
            key={index}
          >
            <span className="text-sm text-slate-300">
              Next round +{index + 1}
            </span>

            <input
              type="number"
              min="0"
              max="250"
              value={score}
              onChange={(event) =>
                onScoreChange(index, Number(event.target.value))
              }
              className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-right"
            />
          </label>
        ))}
      </div>
    </div>
  );
}