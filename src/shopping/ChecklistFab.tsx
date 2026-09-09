import { useEffect, useRef, useState } from "react";
import { ClipboardList, House } from "lucide-react";
import { useProgress } from "../progress/context";
import { habitatListBadgeCount, houseListBadgeCount } from "./allocations";
import { rowRemaining } from "./checklists";
import { ShoppingPanel } from "./ShoppingPanel";

export function ChecklistFab({ scope }: { scope: "habitat" | "house" | "none" }) {
  const { state } = useProgress();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const builds = state.habitatBuilds || {};
  const houseRows = [
    ...(state.houseShopping?.construction || []),
    ...(state.houseShopping?.furnishings || []),
  ];
  const habitatCount = habitatListBadgeCount(builds);
  const houseCount = houseListBadgeCount(houseRows);
  const count = scope === "house" ? houseCount : habitatCount;
  const label = scope === "house" ? "House list" : "Habitat list";
  const badgeLabel =
    scope === "house"
      ? `${count} construction types still needed`
      : `${count} planned copies active`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (scope === "none") return null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="checklist-fab"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}. ${badgeLabel}`}
        title={label}
        onClick={() => setOpen(true)}
      >
        {scope === "house" ? <House size={18} /> : <ClipboardList size={18} />}
        {count > 0 && <span className="fab-badge">{count}</span>}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="shopping-scrim"
            aria-label="Close shopping list"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          />
          <ShoppingPanel
            scope={scope}
            onClose={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          />
        </>
      )}
    </>
  );
}

export function checklistScope(route: string): "habitat" | "house" | "none" {
  if (route.startsWith("#/planner")) return "house";
  if (
    route.startsWith("#/habitats") ||
    route.startsWith("#/dex") ||
    route.startsWith("#/pokemon/")
  )
    return "habitat";
  return "none";
}
