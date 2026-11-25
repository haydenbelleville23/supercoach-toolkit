"use client";

import { useState } from "react";

/**
 * Whole-number input that lets you type freely: the text is kept as typed
 * (it can be empty while editing, and "$250,000" or "250000" both work),
 * the value is saved whenever the text parses, and the display is tidied
 * when you leave the field. Uses a text input with a numeric keyboard on
 * phones, so backspace and selection behave normally.
 */
export default function NumberField({
  label,
  value,
  onChange,
  money = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Show thousands separators when not editing. */
  money?: boolean;
}) {
  const format = (n: number) => (money ? n.toLocaleString("en-AU") : String(n));

  const [text, setText] = useState(format(value));
  const [lastValue, setLastValue] = useState(value);

  // The saved value changed elsewhere (import, another tab): show it.
  if (value !== lastValue) {
    setLastValue(value);

    if (parse(text) !== value) {
      setText(format(value));
    }
  }

  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);

          const parsed = parse(next);
          if (parsed !== null && parsed !== value) {
            setLastValue(parsed);
            onChange(parsed);
          }
        }}
        onBlur={() => setText(format(parse(text) ?? value))}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm tabular-nums outline-none focus:border-violet-500"
      />
    </label>
  );
}

/** Digits only ("$250,000" -> 250000); null while the box is empty. */
function parse(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, "");
  return digits === "" ? null : Number(digits);
}
