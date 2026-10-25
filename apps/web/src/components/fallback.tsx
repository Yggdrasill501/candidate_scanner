/** Shown while a page's data streams in; keeps the header and footer in place. */
export function PageFallback() {
  return (
    <div aria-busy="true" style={{ minHeight: "60vh" }}>
      <p className="crumbs">…</p>
    </div>
  );
}
