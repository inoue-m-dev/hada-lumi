"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";

export default function HealthCheck() {
  const [result, setResult] = useState<Record<string, unknown> | string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await authFetch("/health");
        const data = await res.json();
        setResult(data);
      } catch {
        setResult({ error: "API error" });
      }
    };

    fetchHealth();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>FastAPI Health Check</h1>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}
