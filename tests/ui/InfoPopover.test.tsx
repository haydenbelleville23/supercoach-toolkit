// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import InfoPopover from "@/components/ui/InfoPopover";
import OverflowMenu from "@/components/ui/OverflowMenu";

afterEach(cleanup);

describe("InfoPopover", () => {
  it("opens on tap and closes on a second tap", () => {
    render(<InfoPopover label="About trades left">Trades left in your season pool.</InfoPopover>);
    const trigger = screen.getByRole("button", { name: "About trades left" });

    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.focus(trigger);
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Trades left in your season pool.");
    expect(trigger).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);

    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on keyboard focus and closes on Escape", () => {
    render(<InfoPopover label="About boosts">One extra trade.</InfoPopover>);
    const trigger = screen.getByRole("button", { name: "About boosts" });

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on mouse hover and closes on leave", () => {
    render(<InfoPopover label="Hover me">Hello</InfoPopover>);
    const trigger = screen.getByRole("button", { name: "Hover me" });
    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.pointerLeave(trigger, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps only one open, and closes on an outside tap or scroll", () => {
    render(
      <>
        <InfoPopover label="First">One</InfoPopover>
        <InfoPopover label="Second">Two</InfoPopover>
        <button type="button">elsewhere</button>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "First" }));
    fireEvent.click(screen.getByRole("button", { name: "Second" }));
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Two");

    fireEvent.pointerDown(screen.getByText("elsewhere"));
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "First" }));
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("can be a 44px touch target", () => {
    render(<InfoPopover label="Big" touchTarget>Text</InfoPopover>);
    expect(screen.getByRole("button", { name: "Big" }).className).toContain("h-11 w-11");
  });
});

describe("OverflowMenu", () => {
  const items = (onRename = vi.fn(), onDelete = vi.fn()) => [
    { label: "Duplicate", disabledReason: "3 plans is the most", onSelect: vi.fn() },
    { label: "Rename", onSelect: onRename },
    { label: "Delete", danger: true, onSelect: onDelete },
  ];

  it("lists actions, shows reasons for disabled ones, and runs the chosen one", () => {
    const onRename = vi.fn();
    render(<OverflowMenu label="Actions for Plan 1" items={items(onRename)} />);
    const trigger = screen.getByRole("button", { name: "Actions for Plan 1" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");

    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    const duplicate = screen.getByRole("menuitem", { name: /Duplicate/ });
    expect(duplicate).toHaveAttribute("aria-disabled", "true");
    expect(duplicate).toHaveTextContent("3 plans is the most");

    fireEvent.click(duplicate);
    expect(menu).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onRename).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("works from the keyboard: arrows move, Escape closes and returns focus", () => {
    render(<OverflowMenu label="Actions" items={items()} />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const [first, second] = screen.getAllByRole("menuitem");
    expect(first).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(second).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
