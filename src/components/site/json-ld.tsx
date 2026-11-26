import { serializeJsonLd } from '@/lib/seo';

/** Server-rendered structured data, so crawlers see it without running JavaScript. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
