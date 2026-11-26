import { ImageResponse } from 'next/og';

/*
 * The share card for every page that has no image of its own: the homepage,
 * archives, topics, and articles published without cover art. Drawn from the
 * same two tokens as icon.svg so a shared link looks like the site.
 */
export const alt = 'The Volt V — film, TV, comics, gaming and anime';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#141414',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <path fill="#00e88f" d="M16 13h9.22L32 29.09 38.78 13H48L32 51Z" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
            THE VOLT V
          </div>
          <div style={{ marginTop: 24, fontSize: 40, color: '#a3a3a3' }}>
            Screens, panels and controllers — covered properly.
          </div>
        </div>
        <div style={{ display: 'flex', height: 10, width: 240, background: '#00e88f' }} />
      </div>
    ),
    size,
  );
}
