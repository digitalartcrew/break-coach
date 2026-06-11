export const colors = {
  bg: '#0b0b12',
  surface: '#16161f',
  surfaceAlt: '#1f1f2c',
  border: '#2a2a3a',
  text: '#f5f5fa',
  textDim: '#9a9ab0',
  primary: '#7c5cff',
  primaryDim: '#4a3a99',
  good: '#39d98a',
  ok: '#ffcf5c',
  work: '#ff6b6b',
  accent: '#22d3ee',
};

export function scoreColor(score: number): string {
  if (score >= 80) return colors.good;
  if (score >= 60) return colors.ok;
  return colors.work;
}

export const spacing = (n: number) => n * 8;

export const radius = { sm: 8, md: 14, lg: 22 };
