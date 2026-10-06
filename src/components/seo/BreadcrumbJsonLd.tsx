import JsonLd from './JsonLd';
import { getSiteUrl } from '@/lib/env';

export type BreadcrumbItem = {
  name: string;
  path?: string;
};

export default function BreadcrumbJsonLd({
  items,
}: {
  items: BreadcrumbItem[];
}) {
  const base = getSiteUrl();

  const itemListElement = items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    ...(item.path
      ? { item: new URL(item.path, base).toString() }
      : {}),
  }));

  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement,
      }}
    />
  );
}
