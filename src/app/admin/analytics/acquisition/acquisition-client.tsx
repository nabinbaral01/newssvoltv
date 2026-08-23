'use client';

import { DonutChart } from '@/components/admin/charts/basic-charts';
import { ChartFrame } from '@/components/admin/charts/chart-frame';
import { EmptyState } from '@/components/ui/surface';
import { compactNumber, formatDuration } from '@/lib/utils';

type Row = {
  label: string;
  value: number;
  bounceRate: number;
  avgDurationSeconds: number;
};

const COLUMNS = [
  { key: 'label', label: 'Source' },
  { key: 'value', label: 'Sessions', align: 'right' as const },
  { key: 'bounce', label: 'Bounce rate', align: 'right' as const },
  { key: 'avgTime', label: 'Avg. time', align: 'right' as const },
];

function toRows(data: Row[]) {
  return data.map((row) => ({
    label: row.label,
    value: row.value,
    bounce: `${(row.bounceRate * 100).toFixed(1)}%`,
    avgTime: formatDuration(row.avgDurationSeconds),
  }));
}

function QualityTable({ rows, header }: { rows: Row[]; header: string }) {
  if (!rows.length) {
    return <EmptyState title="Nothing recorded in this period" />;
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="py-2 pr-3 font-medium">{header}</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Sessions</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Bounce</th>
            <th scope="col" className="py-2 text-right font-medium">Avg. time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/60 last:border-0">
              <td className="max-w-64 py-2 pr-3">
                <span className="block truncate">{row.label}</span>
                <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, background: 'var(--series-1)' }}
                  />
                </span>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{compactNumber(row.value)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-muted">
                {(row.bounceRate * 100).toFixed(1)}%
              </td>
              <td className="py-2 text-right tabular-nums text-muted">
                {formatDuration(row.avgDurationSeconds)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AcquisitionClient({
  sources,
  referrers,
  campaigns,
}: {
  sources: Row[];
  referrers: Row[];
  campaigns: Row[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartFrame
          title="Channels"
          description="Classified from the referrer and UTM medium"
          csvName="volt-analytics-channels"
          columns={COLUMNS}
          rows={toRows(sources)}
        >
          <DonutChart data={sources} centreLabel="sessions" />
        </ChartFrame>

        <div className="xl:col-span-2">
          <ChartFrame
            title="Top referrers"
            description="Traffic quality matters as much as volume — a big referrer that bounces is not a win"
            csvName="volt-analytics-referrers"
            columns={[{ ...COLUMNS[0], label: 'Referrer' }, ...COLUMNS.slice(1)]}
            rows={toRows(referrers)}
          >
            <QualityTable rows={referrers} header="Referrer" />
          </ChartFrame>
        </div>
      </div>

      <ChartFrame
        title="Campaign performance"
        description="UTM-tagged arrivals"
        csvName="volt-analytics-campaigns"
        columns={[{ ...COLUMNS[0], label: 'Campaign' }, ...COLUMNS.slice(1)]}
        rows={toRows(campaigns)}
      >
        <QualityTable rows={campaigns} header="Campaign" />
      </ChartFrame>
    </div>
  );
}
