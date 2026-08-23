/**
 * Procedural cover art for the seed.
 *
 * There is no network access during seeding and no licence to stock photos, so
 * every cover is a deterministic abstract SVG derived from the post slug. Real
 * uploads go through the media library and are raster files.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve(process.cwd(), 'public/uploads/seed');

export function ensureSeedDir() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

/** Small deterministic PRNG so the same slug always yields the same art. */
function rngFrom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue: number;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return [hue * 360, s * 100, l * 100];
}

export function coverSvg(seed: string, accent: string): string {
  const rand = rngFrom(seed);
  const [hue, sat] = hexToHsl(accent);
  const h2 = (hue + 30 + rand() * 120) % 360;
  const rot = Math.floor(rand() * 360);
  const W = 1600;
  const H = 900;

  const shapes: string[] = [];
  const shapeCount = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < shapeCount; i++) {
    const kind = rand();
    const x = rand() * W;
    const y = rand() * H;
    const size = 180 + rand() * 620;
    const op = (0.05 + rand() * 0.16).toFixed(3);
    const fill = rand() > 0.5 ? `hsl(${hue} ${sat}% 62%)` : `hsl(${h2} 70% 55%)`;
    if (kind < 0.34) {
      shapes.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(size / 2).toFixed(0)}" fill="${fill}" opacity="${op}"/>`);
    } else if (kind < 0.68) {
      const a = Math.floor(rand() * 90);
      shapes.push(
        `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${size.toFixed(0)}" height="${(size * (0.4 + rand())).toFixed(0)}" rx="${(size * 0.06).toFixed(0)}" fill="${fill}" opacity="${op}" transform="rotate(${a} ${x.toFixed(0)} ${y.toFixed(0)})"/>`,
      );
    } else {
      const w = (size * 0.14).toFixed(0);
      shapes.push(
        `<path d="M${x.toFixed(0)} ${y.toFixed(0)} L${(x + size).toFixed(0)} ${(y - size * 0.6).toFixed(0)}" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" opacity="${op}" fill="none"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
<defs>
<linearGradient id="bg" gradientTransform="rotate(${rot} 0.5 0.5)">
<stop offset="0%" stop-color="hsl(${hue} ${Math.min(70, sat)}% 22%)"/>
<stop offset="55%" stop-color="hsl(${h2.toFixed(0)} 45% 13%)"/>
<stop offset="100%" stop-color="#0d0d0f"/>
</linearGradient>
<radialGradient id="glow" cx="${(0.2 + rand() * 0.6).toFixed(2)}" cy="${(0.2 + rand() * 0.5).toFixed(2)}" r="0.7">
<stop offset="0%" stop-color="hsl(${hue} ${sat}% 60%)" stop-opacity="0.42"/>
<stop offset="100%" stop-color="hsl(${hue} ${sat}% 50%)" stop-opacity="0"/>
</radialGradient>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
${shapes.join('\n')}
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.14"/>
</svg>`;
}

export function writeCover(slug: string, accent: string): string {
  const file = `${slug}.svg`;
  fs.writeFileSync(path.join(OUT_DIR, file), coverSvg(slug, accent), 'utf8');
  return `/uploads/seed/${file}`;
}

export function avatarSvg(name: string, accent: string): string {
  const rand = rngFrom(name);
  const [hue, sat] = hexToHsl(accent);
  const h2 = (hue + 40 + rand() * 200) % 360;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="hsl(${hue} ${sat}% 45%)"/>
<stop offset="100%" stop-color="hsl(${h2.toFixed(0)} 55% 28%)"/>
</linearGradient></defs>
<rect width="200" height="200" fill="url(#g)"/>
<text x="100" y="100" text-anchor="middle" dominant-baseline="central" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="84" font-weight="600" fill="rgba(255,255,255,0.92)" letter-spacing="2">${initials}</text>
</svg>`;
}

export function writeAvatar(name: string, slug: string, accent: string): string {
  const file = `avatar-${slug}.svg`;
  fs.writeFileSync(path.join(OUT_DIR, file), avatarSvg(name, accent), 'utf8');
  return `/uploads/seed/${file}`;
}
