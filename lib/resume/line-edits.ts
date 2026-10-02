export interface LineEdit {
  id: number;
  text: string;
}

export interface LineEditResponse {
  edits: LineEdit[];
}

export function parseLineEditsFromResponse(text: string): LineEdit[] {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : trimmed;

  const parsed = JSON.parse(jsonStr) as Partial<LineEditResponse>;
  if (!Array.isArray(parsed.edits)) {
    throw new Error('Invalid edit response: missing edits array');
  }

  return parsed.edits
    .filter(
      (e): e is LineEdit =>
        typeof e?.id === 'number' &&
        typeof e?.text === 'string' &&
        e.text.trim().length > 0
    )
    .map((e) => ({ id: e.id, text: e.text.trim() }));
}

export function validateLineEdits(
  edits: LineEdit[],
  editableIds: Set<number>
): LineEdit[] {
  const seen = new Set<number>();
  const valid: LineEdit[] = [];

  for (const edit of edits) {
    if (!editableIds.has(edit.id)) continue;
    if (seen.has(edit.id)) continue;
    seen.add(edit.id);
    valid.push(edit);
  }

  return valid;
}

export function applyEditsToLineTexts(
  lines: Array<{ id: number; text: string }>,
  edits: LineEdit[]
): string {
  const editMap = new Map(edits.map((e) => [e.id, e.text]));
  return lines
    .map((line) => editMap.get(line.id) ?? line.text)
    .join('\n');
}

export function normalizeLineText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
