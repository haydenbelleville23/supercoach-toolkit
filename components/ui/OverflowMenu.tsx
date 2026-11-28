"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** Why it can't be used right now; the item is disabled when set. */
  disabledReason?: string | null;
  danger?: boolean;
}

/**
 * A "⋯" menu: a button that opens a list of actions. Keyboard: Enter,
 * Space or Down opens it on the first item; Up and Down move; Escape
 * closes and returns focus; Tab closes. Disabled items stay listed with
 * their reason.
 */
export default function OverflowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const itemButtons = () =>
    [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];

  const focusItem = (step: number | "first") => {
    const buttons = itemButtons();
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = step === "first" ? 0 : (current + step + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  useEffect(() => {
    if (!open) return;
    // Move focus into the menu once it's on screen.
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    buttons[0]?.focus();

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-200 hover:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              focusItem(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              focusItem(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              focusItem("first");
            } else if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "Tab") {
              close(false);
            }
          }}
          className="absolute right-0 z-40 mt-1 w-60 rounded-lg border border-slate-700 bg-slate-950 p-1 shadow-xl"
        >
          {items.map((item) => {
            const disabled = !!item.disabledReason;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                aria-disabled={disabled || undefined}
                onClick={() => {
                  if (disabled) return;
                  close();
                  item.onSelect();
                }}
                className={`flex min-h-11 w-full flex-col items-start justify-center rounded-md px-3 py-1.5 text-left text-sm focus:outline-none focus-visible:bg-slate-800 ${
                  disabled
                    ? "cursor-not-allowed text-slate-500"
                    : item.danger
                      ? "text-red-300 hover:bg-slate-800"
                      : "text-slate-100 hover:bg-slate-800"
                }`}
              >
                <span className="font-semibold">{item.label}</span>
                {disabled && <span className="text-xs">{item.disabledReason}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
