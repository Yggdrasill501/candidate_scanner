"use client";

import { useEffect, useState } from "react";

/**
 * Prehľad / Časová os. Both panels are rendered on the server; the tab only toggles which one
 * shows. A footnote link (#f-…) always switches back to the overview, where facts live.
 */
export function ProfileTabs({
  labels,
  overview,
  timeline,
  aside,
}: {
  labels: [string, string];
  overview: React.ReactNode;
  timeline: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const [tab, setTab] = useState(0);
  useEffect(() => {
    const onHash = () => {
      if (location.hash.startsWith("#f-") || location.hash.startsWith("#c-"))
        setTab(0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return (
    <>
      <div className="tabsrow">
        <div className="tabs" role="tablist">
          {labels.map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              id={`tab-${i}`}
              aria-selected={tab === i}
              aria-controls={`panel-${i}`}
              onClick={() => setTab(i)}
            >
              {label}
            </button>
          ))}
        </div>
        {aside}
      </div>
      <div
        role="tabpanel"
        id="panel-0"
        aria-labelledby="tab-0"
        hidden={tab !== 0}
      >
        {overview}
      </div>
      <div
        role="tabpanel"
        id="panel-1"
        aria-labelledby="tab-1"
        hidden={tab !== 1}
      >
        {timeline}
      </div>
    </>
  );
}
