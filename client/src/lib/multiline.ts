// Render-time, non-destructive normalization of legacy literal line-break
// markers (D-03). The owner historically hacked a literal "/n" (and sometimes
// "\n" — a backslash followed by the letter n) into list rows to fake a line
// break. This converts both literal forms — with any surrounding spaces — to a
// single real newline so existing data displays correctly, WITHOUT mutating the
// stored strings. Pure helper — imports nothing, mirrors slug.ts conventions.
//
// The regex alternation matches the whole token in each form:
//   \\\\n  → the backslash-n literal (a backslash char + the letter n)
//   /n     → the forward-slash-n literal
// Optional surrounding whitespace (\s*) is consumed on both sides so no stray
// space is left behind after the replacement.
export function normalizeMultiline(s: string): string {
  return s.replace(/\s*(?:\\n|\/n)\s*/g, "\n");
}
