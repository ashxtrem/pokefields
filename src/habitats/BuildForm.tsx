import { Minus, Plus } from "lucide-react";

export function parseCopyCount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}

export function RegionChips({
  areas,
  value,
  onChange,
  disabled,
  label = "Where?",
}: {
  areas: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <fieldset className="field build-region-field">
      <legend>{label}</legend>
      <div className="region-chips build-region-chips">
        {areas.map((area) => (
          <button
            type="button"
            key={area}
            className={value === area ? "chip active" : "chip"}
            disabled={disabled}
            aria-pressed={value === area}
            onClick={() => onChange(area)}
          >
            {area}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function CopyStepper({
  value,
  onChange,
  disabled,
  label = "Copies",
  restoreOnBlur = false,
  fallback = 1,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  restoreOnBlur?: boolean;
  fallback?: number;
}) {
  const n = parseCopyCount(value);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="copy-stepper">
        <button
          type="button"
          className="icon-button qty-btn"
          aria-label="Fewer copies"
          disabled={disabled || !n || n <= 1}
          onClick={() => onChange(String(Math.max(1, (n || 1) - 1)))}
        >
          <Minus size={16} />
        </button>
        <input
          className="qty-input"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          aria-label={label}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => {
            if (restoreOnBlur && !parseCopyCount(value))
              onChange(String(fallback));
          }}
        />
        <button
          type="button"
          className="icon-button qty-btn"
          aria-label="More copies"
          disabled={disabled}
          onClick={() => onChange(String((n || 0) + 1))}
        >
          <Plus size={16} />
        </button>
      </div>
    </label>
  );
}
