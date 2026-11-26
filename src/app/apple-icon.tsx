import { ImageResponse } from 'next/og';

/*
 * A raster copy of icon.svg. iOS home screens need a PNG, and Google's
 * publisher-logo guidance asks for a raster image at least 112px square, so
 * the organisation's structured data points here rather than at the SVG.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#141414',
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path fill="#00e88f" d="M16 13h9.22L32 29.09 38.78 13H48L32 51Z" />
        </svg>
      </div>
    ),
    size,
  );
}
