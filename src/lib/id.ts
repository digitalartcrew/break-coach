/** Lightweight unique-ish id for local sessions. */
export function uid(prefix = 'id'): string {
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
