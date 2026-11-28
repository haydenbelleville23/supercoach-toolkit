"use client";

import { Info } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// Only one popover open at a time: opening one tells the others to close.
const OPEN_EVENT = "footynomics:info-popover-open";

const GAP = 6;
const MARGIN = 8;

/**
 * A small info popover: opens on mouse hover, keyboard focus and tap or
 * click, and closes on Escape, a tap or click outside, or scrolling. It
 * sits inside the viewport, below the trigger or above it when there's
 * more room there, and never off-screen at 375px. The trigger is a real
 * button with an accessible name; the content is linked to it with
 * aria-describedby while open. No focus trap; no animation.
 */
export default function InfoPopover({
  label,
  children,
  trigger,
  triggerClassName,
  touchTarget = false,
  widthRem = 18,
}: {
  /** Accessible name of the trigger, e.g. "About trades left". */
  label: string;
  children: ReactNode;
  /** What the trigger shows (default: an info icon). */
  trigger?: ReactNode;
  /** Replaces the default trigger styling. */
  triggerClassName?: string;
  /** 44px hit area, for primary controls. */
  touchTarget?: boolean;
  widthRem?: number;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // How it was opened: hover closes on leave; tap and focus stay open.
  const [openedBy, setOpenedBy] = useState<"hover" | "pin">("pin");
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // A tap or click focuses the button too; only keyboard focus opens on focus.
  const pressingRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const show = useCallback(
    (by: "hover" | "pin") => {
      setOpenedBy(by);
      setOpen(true);
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
    },
    [id],
  );
  const hide = useCallback(() => setOpen(false), []);

  // Close when another popover opens.
  useEffect(() => {
    const onOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [id]);

  // Escape, outside tap or click, scroll and resize close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  // Place it inside the viewport: below, or above when there's more room.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(widthRem * 16, viewportWidth - MARGIN * 2);
    panel.style.width = `${width}px`;
    const height = panel.offsetHeight;

    const below = viewportHeight - trigger.bottom - GAP - MARGIN;
    const above = trigger.top - GAP - MARGIN;
    const placeAbove = height > below && above > below;
    const top = placeAbove
      ? Math.max(MARGIN, trigger.top - GAP - height)
      : Math.min(trigger.bottom + GAP, Math.max(MARGIN, viewportHeight - MARGIN - height));
    const centred = trigger.left + trigger.width / 2 - width / 2;
    const left = Math.min(Math.max(MARGIN, centred), viewportWidth - MARGIN - width);

    setPosition({ top, left, width });
  }, [open, widthRem]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => {
          pressingRef.current = false;
          if (open && openedBy === "pin") hide();
          else show("pin");
        }}
        onPointerDown={() => {
          pressingRef.current = true;
        }}
        onFocus={() => {
          if (!pressingRef.current && !open) show("pin");
        }}
        onBlur={(event) => {
          if (!panelRef.current?.contains(event.relatedTarget as Node)) hide();
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse" && !open) show("hover");
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse" && openedBy === "hover") hide();
        }}
        className={
          triggerClassName ??
          `inline-flex shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            touchTarget ? "h-11 w-11" : "h-6 w-6"
          }`
        }
      >
        {trigger ?? <Info aria-hidden="true" className="h-4 w-4" />}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width: position?.width,
            }}
            className="z-[60] rounded-lg border border-slate-700 bg-slate-950 p-3 text-left text-xs font-normal normal-case leading-5 tracking-normal text-slate-200 shadow-xl"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
