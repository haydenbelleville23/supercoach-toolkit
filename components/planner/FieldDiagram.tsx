"use client";

import type { FieldLayout, FieldSpot } from "@/lib/planner/fieldLayout";

/** Short name for a compact chip: "N. Daicos" or the rookie label. */
function shortName(spot: FieldSpot): string {
  const name = spot.player?.name ?? "";

  if (spot.placeholder) {
    return name.replace("Rookie (TBC) ", "Rookie ");
  }

  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
}

/**
 * The squad after a round's trades, by line. Bye players are dimmed and
 * tagged "BYE"; players traded in are tagged "IN"; rookies are tagged.
 */
export default function FieldDiagram({ layout }: { layout: FieldLayout }) {
  const area = (name: "field" | "bench") => layout.lines.filter((l) => l.area === name);

  return (
    <div className="space-y-3 text-xs">
      <p className="text-slate-300">
        Playing on field <strong className="text-white">{layout.playingOnField}/{layout.onFieldSlots}</strong>
        {" · "}
        Playing total <strong className="text-white">{layout.playingTotal}/{layout.squadSize}</strong>
      </p>

      {(["field", "bench"] as const).map((name) => (
        <div key={name}>
          <p className="mb-1 font-semibold uppercase tracking-wide text-slate-400">
            {name === "field" ? "On field" : "Bench"}
          </p>

          <div className="space-y-1.5">
            {area(name).map((line) => (
              <div key={`${name}-${line.position}`} className="flex gap-1.5">
                <span className="w-10 shrink-0 pt-1 font-semibold text-slate-400">
                  {line.position}
                </span>

                <ul className="flex flex-1 flex-wrap gap-1">
                  {line.spots.map((spot) => (
                    <li
                      key={spot.slotId}
                      className={`rounded-md border px-1.5 py-1 leading-tight ${
                        !spot.player
                          ? "border-dashed border-slate-700 text-slate-500"
                          : spot.onBye
                            ? "border-slate-700 bg-slate-950 text-slate-500 opacity-60"
                            : spot.tradedIn
                              ? "border-emerald-500/60 bg-emerald-500/10 text-white"
                              : "border-slate-700 bg-slate-800/60 text-white"
                      }`}
                    >
                      {spot.player ? (
                        <>
                          <span className={spot.onBye ? "line-through" : undefined}>
                            {shortName(spot)}
                          </span>
                          {spot.onBye && (
                            <span className="ml-1 rounded bg-slate-700 px-1 text-[10px] font-bold text-slate-200">
                              BYE
                            </span>
                          )}
                          {spot.tradedIn && (
                            <span className="ml-1 rounded bg-emerald-500/30 px-1 text-[10px] font-bold text-emerald-100">
                              IN
                            </span>
                          )}
                          {spot.placeholder && (
                            <span className="ml-1 rounded bg-violet-500/30 px-1 text-[10px] font-bold text-violet-100">
                              TBC
                            </span>
                          )}
                        </>
                      ) : (
                        "Empty"
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}

      {layout.tradedOut.length > 0 && (
        <p className="text-slate-300">
          <span className="font-semibold text-red-300">Out:</span>{" "}
          {layout.tradedOut.map((p) => p.name).join(", ")}
        </p>
      )}
    </div>
  );
}
