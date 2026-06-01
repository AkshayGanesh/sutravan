import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface RepeatableRowsProps {
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
  addLabel?: string;
}

/**
 * A list of single-line text rows with per-row remove and a "+ Add" affordance
 * (D-06). Used for product benefits / ingredients / usage tips. Small and
 * dependency-free, so this stub is also the real implementation — feature plans
 * can use it as-is.
 *
 * The "+ Add" control uses the forest-green accent per UI-SPEC (one of the four
 * sanctioned green affordances).
 */
export default function RepeatableRows({
  value,
  onChange,
  label,
  addLabel = "+ Add",
}: RepeatableRowsProps) {
  function updateRow(index: number, next: string) {
    onChange(value.map((row, i) => (i === index ? next : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, ""]);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {value.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={row}
              onChange={(e) => updateRow(index, e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              aria-label={`Remove ${label} row ${index + 1}`}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={addRow}
        className="text-primary"
      >
        <Plus className="size-4" aria-hidden="true" />
        {addLabel.replace(/^\+\s*/, "")}
      </Button>
    </div>
  );
}
