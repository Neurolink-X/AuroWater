type JsonLdObject = Record<string, unknown>;

type JsonLdProps = {
  /** One schema object, or an array of them */
  data: JsonLdObject | JsonLdObject[];
  /** Optional: helps you find the block in DevTools (e.g. "breadcrumb") */
  id?: string;
  /** Optional: only needed if you add a strict Content-Security-Policy with nonces */
  nonce?: string;
};

/**
 * Turns an object into a script-safe JSON string.
 * - JSON.stringify drops `undefined` values automatically.
 * - The replaces stop "</script>" tricks and odd line-break characters
 *   from breaking the page or injecting code.
 */
function serialize(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export default function JsonLd({ data, id, nonce }: JsonLdProps) {
  const isEmpty = Array.isArray(data) ? data.length === 0 : !data || Object.keys(data).length === 0;
  if (isEmpty) return null;

  return (
    <script
      id={id ? `jsonld-${id}` : undefined}
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  );
}
