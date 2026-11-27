"use client";

import { useSyncExternalStore } from "react";
import { ABANDONMENTS_EVENT, countLocalAbandonments } from "@/lib/localAbandonments.mjs";

const serverCount = () => 0;

function subscribe(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(ABANDONMENTS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(ABANDONMENTS_EVENT, callback);
  };
}

export default function OrganizationAbandonments({ organizationId }) {
  const count = useSyncExternalStore(subscribe, () => {
    try { return countLocalAbandonments(window.localStorage, organizationId); }
    catch { return 0; }
  }, serverCount);

  return <div><dt className="meta">Major abandonments</dt><dd className="tabular mt-1 text-[24px] font-medium">
    {count}
  </dd></div>;
}
