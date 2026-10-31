"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

export default function OrganizationAbandonments({ organizationId }) {
  const { user, loading } = useAuth();
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!user || !organizationId) return;
    return onSnapshot(query(collection(db, "users", user.uid, "abandonments"), where("organizationId", "==", organizationId)),
      snapshot => setResult({ uid: user.uid, organizationId, count: snapshot.size }),
      () => setResult({ uid: user.uid, organizationId, error: true }));
  }, [user, organizationId]);

  const current = result?.uid === user?.uid && result?.organizationId === organizationId ? result : null;
  return <div><dt className="meta">Major abandonments</dt><dd className="tabular mt-1 text-[24px] font-medium">
    {current?.error || (!loading && !user) ? "—" : current ? current.count : "…"}
  </dd>{current?.error && <p className="meta">Could not load abandonments.</p>}</div>;
}
