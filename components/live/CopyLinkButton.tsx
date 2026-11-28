"use client";

import { Check, Link2 } from "lucide-react";
import { useEffect, useState } from "react";

/** Copies text with the Clipboard API, or the older execCommand route. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the older route.
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand?.("copy") ?? false;
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * "Copy link" for the selected match. Shows "Copied" when it worked; where
 * the browser can't copy, shows the link selected so it can be copied by
 * hand.
 */
export default function CopyLinkButton({ getUrl, className = "" }: { getUrl: () => string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const [manualUrl, setManualUrl] = useState("");

  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={async () => {
          const url = getUrl();
          if (await copyText(url)) {
            setState("copied");
          } else {
            setManualUrl(url);
            setState("manual");
          }
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        {state === "copied" ? (
          <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
        )}
        {state === "copied" ? "Copied" : "Copy link"}
      </button>

      <span aria-live="polite" className="sr-only">
        {state === "copied" ? "Link copied" : ""}
      </span>

      {state === "manual" && (
        <label className="mt-1 block text-[11px] text-slate-400">
          Copy this link:
          <input
            readOnly
            autoFocus
            value={manualUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-0.5 block w-56 max-w-[70vw] rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-200"
          />
        </label>
      )}
    </div>
  );
}
