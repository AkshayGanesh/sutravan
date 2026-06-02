import { useEffect, useRef, useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { Reorder, useDragControls } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface RepeatableRowsProps {
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
  addLabel?: string;
}

/**
 * A list of single-line text rows with drag-to-reorder (handle-only), per-row
 * remove and a "+ Add" affordance (D-06). Used for product benefits /
 * ingredients / usage tips.
 *
 * Reorder identity is a STABLE internal numeric id — never the row string (rows
 * can be empty/duplicate) and never the array index. Ids are bookkeeping only
 * and never leak to the parent: `onChange` always emits `string[]`.
 *
 * Each row is a multi-line Textarea: pressing Enter inserts a newline WITHIN
 * the same bullet (that is the feature) — Enter is never intercepted. The
 * stored value stays the controlled `string[]` (newlines included).
 *
 * Dragging starts only from the GripVertical handle (`dragListener={false}` +
 * `useDragControls`), so clicking into the Textarea still selects/edits text
 * without fighting a drag.
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
  // Monotonic id minter — survives reorders/edits, only grows.
  const nextIdRef = useRef(0);
  const mintId = () => nextIdRef.current++;

  // Internal ids aligned 1:1 with the controlled `value` array by position.
  const [ids, setIds] = useState<number[]>(() => value.map(() => mintId()));

  // Reconcile when `value` changes from OUTSIDE (form reset / loading a
  // product). We only own ids when the count matches; on a length mismatch we
  // regenerate so ids realign with the new array. Edits/reorders keep the same
  // length, so they never trigger regeneration here.
  useEffect(() => {
    setIds((prev) => {
      if (prev.length === value.length) return prev;
      return value.map(() => mintId());
    });
  }, [value]);

  function updateRow(index: number, next: string) {
    onChange(value.map((row, i) => (i === index ? next : row)));
  }

  function removeRow(index: number) {
    setIds((prev) => prev.filter((_, i) => i !== index));
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    setIds((prev) => [...prev, mintId()]);
    onChange([...value, ""]);
  }

  function handleReorder(newIds: number[]) {
    // Map each id back to its current string, then emit the new string order.
    const idToValue = new Map<number, string>();
    ids.forEach((id, i) => idToValue.set(id, value[i] ?? ""));
    const ordered = newIds.map((id) => idToValue.get(id) ?? "");
    setIds(newIds);
    onChange(ordered);
  }

  // Guard against any transient id/value misalignment during reconcile.
  const rows = ids.length === value.length ? ids : value.map(() => mintId());

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Reorder.Group
        axis="y"
        values={rows}
        onReorder={handleReorder}
        className="space-y-2"
      >
        {rows.map((id, index) => (
          <RepeatableRow
            key={id}
            id={id}
            index={index}
            label={label}
            value={value[index] ?? ""}
            onEdit={(next) => updateRow(index, next)}
            onRemove={() => removeRow(index)}
          />
        ))}
      </Reorder.Group>
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

interface RepeatableRowProps {
  id: number;
  index: number;
  label: string;
  value: string;
  onEdit: (next: string) => void;
  onRemove: () => void;
}

/**
 * Single reorderable row. Extracted into its own component so `useDragControls`
 * is called once per row at the top level (never inside a `.map` callback).
 */
function RepeatableRow({
  id,
  index,
  label,
  value,
  onEdit,
  onRemove,
}: RepeatableRowProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className="flex items-start gap-2"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="cursor-grab touch-none text-muted-foreground"
        aria-label={`Reorder ${label} row ${index + 1}`}
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </Button>
      <Textarea
        value={value}
        onChange={(e) => onEdit(e.target.value)}
        rows={2}
        className="flex-1"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`Remove ${label} row ${index + 1}`}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </Reorder.Item>
  );
}
