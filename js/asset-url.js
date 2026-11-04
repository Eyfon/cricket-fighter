// The import-map revision changes with the asset checksum manifest as well as code.
// Keep configured paths unchanged; only network requests receive the revision.
const revision = new URL(import.meta.url).searchParams.get('v');
export function assetUrl(src, version = revision) {
  if (!version) return src;
  return `${src}${src.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}
