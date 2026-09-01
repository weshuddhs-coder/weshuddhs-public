/**
 * Courier and channel data store the buyer's name in whatever shape they got
 * it — 'RekhaGrover', 'REKHA GROVER', 'rekha grover', 'r.k. sharma'. Rendering
 * that raw on the public tracking page (under a CSS uppercase rule) produced
 * greetings like "HI REKHAGROVER,".
 *
 * Split camelCase runs back apart, take the first real name (skipping bare
 * initials), and Title Case it so the greeting reads like a person.
 */
export function friendlyName(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const spaced = raw
    .replace(/[._]+/g, ' ')
    // 'RekhaGrover' → 'Rekha Grover'. Latin-1 range keeps accented names intact.
    .replace(/([a-zà-ÿ])([A-Z])/g, '$1 $2')
    .trim();

  const parts = spaced.split(/\s+/).filter(Boolean);
  // 'R K Sharma' → prefer 'Sharma' over the bare initial 'R'.
  const first = parts.find((p) => p.length > 1) || parts[0];
  if (!first) return null;

  const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  // A pathological single-token name must not blow out the hero line.
  return name.length > 20 ? name.slice(0, 20) : name;
}
