'use client';

import { BarList, DonutChart, type Slice } from '@/components/admin/charts/basic-charts';
import { ChartFrame } from '@/components/admin/charts/chart-frame';
import { compactNumber } from '@/lib/utils';

function toRows(data: Slice[]) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return data.map((row) => ({
    label: row.label,
    value: row.value,
    share: total ? `${((row.value / total) * 100).toFixed(1)}%` : '0%',
  }));
}

const COLUMNS = [
  { key: 'label', label: 'Value' },
  { key: 'value', label: 'Views', align: 'right' as const },
  { key: 'share', label: 'Share', align: 'right' as const },
];

export function TechnologyClient({
  devices,
  browsers,
  operatingSystems,
  screenWidths,
}: {
  devices: Slice[];
  browsers: Slice[];
  operatingSystems: Slice[];
  screenWidths: Slice[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartFrame
        title="Device type"
        description="Sessions, from the user-agent string"
        csvName="volt-analytics-devices"
        columns={COLUMNS}
        rows={toRows(devices)}
      >
        <DonutChart data={devices} centreLabel="sessions" />
      </ChartFrame>

      <ChartFrame
        title="Screen width"
        description="Viewport at the moment of the page view — the number that should drive your breakpoints"
        csvName="volt-analytics-screen-widths"
        columns={COLUMNS}
        rows={toRows(screenWidths)}
      >
        {/* Ordinal: the buckets have an inherent order, so the ramp encodes it. */}
        <BarList data={screenWidths} ordinal formatValue={compactNumber} />
      </ChartFrame>

      <ChartFrame
        title="Browsers"
        csvName="volt-analytics-browsers"
        columns={COLUMNS}
        rows={toRows(browsers)}
      >
        <BarList data={browsers} formatValue={compactNumber} />
      </ChartFrame>

      <ChartFrame
        title="Operating systems"
        csvName="volt-analytics-os"
        columns={COLUMNS}
        rows={toRows(operatingSystems)}
      >
        <BarList data={operatingSystems} formatValue={compactNumber} />
      </ChartFrame>
    </div>
  );
}
