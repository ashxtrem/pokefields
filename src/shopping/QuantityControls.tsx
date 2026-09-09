import { SupplyIcon } from "./SupplyIcon";
import { useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { QuantityRow } from "./checklists";
import { rowRemaining } from "./checklists";

export function QuantityControls({
  label,
  required,
  gathered,
  disabled,
  onChange,
  onHaveAll,
  onReset,
}: {
  label: string;
  required: number;
  gathered: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onHaveAll?: () => void;
  onReset?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const remaining = Math.max(required - gathered, 0);
  const commit = (raw: string | null) => {
    setDraft(null);
    if (raw === null || raw.trim() === "") return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    onChange(Math.floor(value));
  };
  return (
    <div className="quantity-row">
      <div className="quantity-copy">
        <div className="supply-label">
          <SupplyIcon label={label} />
          <div>
            <strong>{label}</strong>
            <span>
              {gathered} / {required}
              {remaining > 0 ? ` · Need ${remaining} more` : " · Ready"}
            </span>
          </div>
        </div>
      </div>
      <div className="quantity-controls">
        <button
          type="button"
          className="icon-button qty-btn"
          aria-label={`Remove one ${label}`}
          disabled={disabled || gathered <= 0}
          onClick={() => onChange(gathered - 1)}
        >
          <Minus size={16} />
        </button>
        <input
          className="qty-input"
          aria-label={`Gathered ${label}`}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          disabled={disabled}
          value={draft ?? String(gathered)}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <button
          type="button"
          className="icon-button qty-btn"
          aria-label={`Add one ${label}`}
          disabled={disabled || gathered >= required}
          onClick={() => onChange(gathered + 1)}
        >
          <Plus size={16} />
        </button>
        {onHaveAll && (
          <button
            type="button"
            className="button secondary qty-action"
            disabled={disabled || gathered >= required}
            onClick={onHaveAll}
          >
            Have all
          </button>
        )}
        {onReset && gathered > 0 && (
          <button
            type="button"
            className="text-button"
            disabled={disabled}
            onClick={onReset}
          >
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>
    </div>
  );
}

export function HouseQuantitySection({
  title,
  rows,
  disabled,
  onChange,
}: {
  title: string;
  rows: QuantityRow[];
  disabled?: boolean;
  onChange: (id: string, gathered: number) => void;
}) {
  if (!rows.length) return null;
  return (
    <section className="quantity-section">
      <h3>{title}</h3>
      {rows.map((row) => (
        <QuantityControls
          key={row.id}
          label={row.label}
          required={row.quantity}
          gathered={row.gathered}
          disabled={disabled}
          onChange={(value) => onChange(row.id, value)}
          onHaveAll={() => onChange(row.id, row.quantity)}
          onReset={() => onChange(row.id, 0)}
        />
      ))}
    </section>
  );
}

export function QuantitySummary({ rows }: { rows: QuantityRow[] }) {
  const needed = rows.filter((row) => rowRemaining(row) > 0).length;
  return (
    <span className="quantity-summary">
      {needed ? `${needed} item types still needed` : "All tracked items ready"}
    </span>
  );
}
