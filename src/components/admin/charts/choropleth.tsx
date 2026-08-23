'use client';

import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import countries from 'i18n-iso-countries';
import * as React from 'react';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Topology } from 'topojson-specification';

import worldTopo from 'world-atlas/countries-110m.json';
import { compactNumber, countryName } from '@/lib/utils';

/**
 * World choropleth.
 *
 * Sequential encoding: one hue, light→dark, because the variable is magnitude.
 * The map is a locator, not the source of truth — the table beside it carries
 * the numbers, so a reader who cannot separate the steps still gets them.
 */

const RAMP = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)'];

type CountryFeature = {
  type: 'Feature';
  id?: string | number;
  properties: { name?: string };
  geometry: Geometry;
};

const world = feature(
  worldTopo as unknown as Topology,
  (worldTopo as unknown as Topology).objects.countries,
) as unknown as FeatureCollection<Geometry, { name?: string }>;

export type CountryDatum = { code: string; value: number };

export function Choropleth({
  data,
  selected,
  onSelect,
  metricLabel = 'page views',
  height = 380,
}: {
  data: CountryDatum[];
  selected?: string | null;
  onSelect?: (code: string | null) => void;
  metricLabel?: string;
  height?: number;
}) {
  const [hover, setHover] = React.useState<{ code: string; value: number; x: number; y: number } | null>(null);

  // Numeric ISO ids are what the topology carries; our data is alpha-2.
  const byNumeric = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const row of data) {
      const numeric = countries.alpha2ToNumeric(row.code.toUpperCase());
      if (numeric) map.set(String(Number(numeric)), row.value);
    }
    return map;
  }, [data]);

  const max = Math.max(...data.map((row) => row.value), 1);

  // Quantile-ish steps on a log scale: traffic is extremely long-tailed, and a
  // linear ramp would paint everything but the top country the same colour.
  const stepFor = (value: number) => {
    if (!value) return -1;
    const ratio = Math.log10(value + 1) / Math.log10(max + 1);
    return Math.min(RAMP.length - 1, Math.floor(ratio * RAMP.length));
  };

  const projection = geoNaturalEarth1().fitSize([900, height], world as unknown as GeoPermissibleObjects);
  const path = geoPath(projection);

  const thresholds = RAMP.map((_, index) =>
    Math.round(10 ** ((index / RAMP.length) * Math.log10(max + 1)) - 1),
  );

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 900 ${height}`}
        className="w-full"
        role="img"
        aria-label={`World map shaded by ${metricLabel}. The table below lists the same figures.`}
      >
        <rect width="900" height={height} fill="transparent" onClick={() => onSelect?.(null)} />
        {(world.features as unknown as CountryFeature[]).map((countryFeature, index) => {
          const id = String(Number(countryFeature.id ?? -1));
          const value = byNumeric.get(id) ?? 0;
          const step = stepFor(value);
          const alpha2 = countries.numericToAlpha2(id) ?? '';
          const isSelected = selected && alpha2 === selected;
          const d = path(countryFeature as unknown as GeoPermissibleObjects);
          if (!d) return null;

          return (
            <path
              key={countryFeature.id ?? index}
              d={d}
              fill={step < 0 ? 'var(--seq-empty)' : RAMP[step]}
              stroke={isSelected ? 'var(--chart-primary)' : 'var(--chart-surface)'}
              strokeWidth={isSelected ? 1.6 : 0.4}
              className={value ? 'cursor-pointer' : undefined}
              onMouseMove={(event) => {
                if (!value) return;
                const box = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                setHover({
                  code: alpha2,
                  value,
                  x: event.clientX - (box?.left ?? 0),
                  y: event.clientY - (box?.top ?? 0),
                });
              }}
              onMouseLeave={() => setHover(null)}
              onClick={() => value && onSelect?.(alpha2 === selected ? null : alpha2)}
            >
              {/* One interpolated string, not several children: React separates
                  adjacent text nodes with comment markers when it streams HTML,
                  and inside an SVG <title> those do not survive hydration. */}
              <title>
                {`${countryFeature.properties?.name ?? alpha2}: ${compactNumber(value)} ${metricLabel}`}
              </title>
            </path>
          );
        })}
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-card border border-border bg-elevated px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <p className="font-medium">{countryName(hover.code)}</p>
          <p className="tabular-nums text-muted">
            {compactNumber(hover.value)} {metricLabel}
          </p>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="text-[11px] uppercase tracking-wide text-muted">Fewer</span>
        <div className="flex items-center gap-0.5">
          {RAMP.map((colour, index) => (
            <span key={colour} className="flex flex-col items-center gap-0.5">
              <span
                aria-hidden
                className="block h-3 w-8 rounded-sm"
                style={{ background: colour }}
              />
              <span className="text-[10px] tabular-nums text-muted">
                {compactNumber(thresholds[index])}+
              </span>
            </span>
          ))}
        </div>
        <span className="text-[11px] uppercase tracking-wide text-muted">More</span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span aria-hidden className="block size-3 rounded-sm" style={{ background: 'var(--seq-empty)' }} />
          No traffic
        </span>
      </div>
    </div>
  );
}
