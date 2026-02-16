// frontend/src/components/cycles/CyclesScreen.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authFetch } from "@/lib/api";
import { formatYmdLocal } from "@/lib/date";

// 🎨 指定パレット
const UI = {
  title: "#574143",
  bg: "#FDFCFC",
  border: "#E6E7EB",
  text: "#596377",
  sub: "#B4B7C0",
  bad: "#EBCFD1",
  neutral: "#FFE3E5", // 閉じる
  good: "#FFF1F3",
} as const;

type CycleLog = {
  cycle_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
};

export default function CyclesScreen() {
  const searchParams = useSearchParams();

  const selectedDate = useMemo(() => {
    const d = searchParams.get("date");
    if (d) return d;
    return formatYmdLocal(new Date());
  }, [searchParams]);

  const from = useMemo(() => searchParams.get("from"), [searchParams]);

  const closeHref = useMemo(() => {
    if (from === "calendar") {
      const params = new URLSearchParams({
        date: selectedDate,
        openRecord: "1",
      });
      return `/calendar?${params.toString()}`;
    }
    return `/records?date=${selectedDate}`;
  }, [from, selectedDate]);

  const today = formatYmdLocal(new Date());

  const [cycles, setCycles] = useState<CycleLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [startDraft, setStartDraft] = useState<string>(selectedDate);
  const [endDraft, setEndDraft] = useState<string>(selectedDate);
  const [isEditingStart, setIsEditingStart] = useState(false);

  // ✅ ロールバック用（直前の値を退避）
  const prevStartRef = useRef<string>(selectedDate);
  const prevEndRef = useRef<string>(selectedDate);

  // ✅ 開始日「修正」モードのキャンセル復帰先
  const prevStartBeforeEditRef = useRef<string>(selectedDate);

  const openCycle = useMemo(
    () => cycles.find((c) => c.end_date === null) ?? null,
    [cycles]
  );

  useEffect(() => {
    if (openCycle) {
      setIsEditingStart(false);
      setStartDraft(openCycle.start_date);
      setEndDraft(selectedDate);

      prevStartRef.current = openCycle.start_date;
      prevEndRef.current = selectedDate;
      prevStartBeforeEditRef.current = openCycle.start_date;
      return;
    }

    setIsEditingStart(false);
    setStartDraft(selectedDate);
    setEndDraft(selectedDate);

    prevStartRef.current = selectedDate;
    prevEndRef.current = selectedDate;
    prevStartBeforeEditRef.current = selectedDate;
  }, [selectedDate, openCycle]);

  const fetchCycles = async () => {
    const res = await authFetch("/cycles?limit=6", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`GET /cycles failed: ${res.status}`);
    const json = await res.json();
    setCycles(json.cycles as CycleLog[]);
  };

  function PastCycleCard({
    cycle,
    isSaving,
    onUpdated,
  }: {
    cycle: CycleLog;
    isSaving: boolean;
    onUpdated: () => Promise<void>;
  }) {
    const [start, setStart] = useState<string>(cycle.start_date);
    const [end, setEnd] = useState<string>(cycle.end_date ?? "");

    useEffect(() => {
      setStart(cycle.start_date);
      setEnd(cycle.end_date ?? "");
    }, [cycle.cycle_id, cycle.start_date, cycle.end_date]);

    const handleUpdate = async () => {
      const prevStart = start;
      const prevEnd = end;

      if (end && end < start) {
        setError("終了日は開始日以降の日付を指定してください");
        return;
      }
      if (start > today || (end && end > today)) {
        setError("開始日・終了日は未来の日付を指定できません");
        return;
      }

      setError(null);
      setMessage(null);

      setIsSaving(true);
      try {
        const res = await authFetch(`/cycles/${cycle.cycle_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_date: start || null,
            end_date: end ? end : null,
          }),
        });
        if (!res.ok) throw new Error(`PATCH /cycles/{id} failed: ${res.status}`);
        await onUpdated();
        setMessage("更新しました");
      } catch (e) {
        console.error(e);
        setError("更新に失敗しました");
        setStart(prevStart);
        setEnd(prevEnd);
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div
        className="rounded-2xl border p-4 space-y-3 shadow-sm"
        style={{ borderColor: UI.border, backgroundColor: UI.bg }}
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <p className="text-[11px]" style={{ color: UI.sub }}>
              開始日
            </p>
            <input
              type="date"
              value={start}
              max={today}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-xl border px-3 py-3 text-sm font-semibold"
              style={{
                borderColor: UI.border,
                backgroundColor: UI.bg,
                color: UI.text,
              }}
            />
          </label>

          <label className="space-y-1">
            <p className="text-[11px]" style={{ color: UI.sub }}>
              終了日
            </p>
            <input
              type="date"
              value={end}
              max={today}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-xl border px-3 py-3 text-sm font-semibold"
              style={{
                borderColor: UI.border,
                backgroundColor: UI.bg,
                color: UI.text,
              }}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={isSaving || !start}
            onClick={handleUpdate}
            className="px-3 py-2 rounded-lg border text-xs font-semibold disabled:opacity-60"
            style={{
              borderColor: UI.border,
              backgroundColor: UI.bad,
              color: UI.text,
            }}
          >
            更新
          </button>
        </div>
      </div>
    );
  }

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        await fetchCycles();
      } catch (e) {
        console.error(e);
        setError("生理ログの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: UI.bg }}>
      {/* ✅ ヘッダー：下線消す / 戻るだけ */}
      <header className="px-4 py-3 flex items-center justify-end">
        <Link
          href={closeHref}
          className="text-xs font-semibold px-3 py-2 rounded-lg border"
          style={{
            borderColor: UI.border,
            backgroundColor: UI.bg,
            color: UI.text,
          }}
        >
          閉じる
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* ステータス */}
        {(error || message) && (
          <div className="text-xs">
            {error && <p className="text-red-500">{error}</p>}
            {message && !error && <p style={{ color: UI.sub }}>{message}</p>}
          </div>
        )}

        {isLoading && (
          <p className="text-xs" style={{ color: UI.sub }}>
            読み込み中…
          </p>
        )}

        {/* ✅ 登録カード（影つき） */}
        <section>
          <div
            className="rounded-2xl border p-4 space-y-3 shadow-sm"
            style={{ borderColor: UI.border, backgroundColor: UI.bg }}
          >
            <div className="space-y-1">
              <p className="text-[15px] font-semibold" style={{ color: UI.title }}>
                登録
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px]" style={{ color: UI.sub }}>
                    開始日
                  </p>

                  {openCycle && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isEditingStart) {
                          prevStartBeforeEditRef.current = startDraft;
                          setError(null);
                          setMessage(null);
                          setIsEditingStart(true);
                          return;
                        }

                        setStartDraft(prevStartBeforeEditRef.current);
                        setError(null);
                        setMessage(null);
                        setIsEditingStart(false);
                      }}
                      className="text-[11px] underline"
                      style={{ color: UI.sub }}
                    >
                      {isEditingStart ? "キャンセル" : "開始日を修正"}
                    </button>
                  )}
                </div>

                <input
                  type="date"
                  value={startDraft}
                  max={today}
                  onChange={(e) => setStartDraft(e.target.value)}
                  disabled={!!openCycle && !isEditingStart}
                  className="w-full rounded-xl border px-3 py-3 text-sm font-semibold disabled:opacity-60"
                  style={{
                    borderColor: UI.border,
                    backgroundColor: UI.bg,
                    color: UI.text,
                  }}
                />

                {openCycle && isEditingStart && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={isSaving || !startDraft}
                      onClick={async () => {
                        if (!openCycle) return;

                        prevStartRef.current = openCycle.start_date;
                        prevEndRef.current = endDraft;

                        if (!startDraft) {
                          setError("開始日を入力してください");
                          return;
                        }
                        if (startDraft > today) {
                          setError("開始日は未来の日付を指定できません");
                          return;
                        }
                        if (endDraft && endDraft < startDraft) {
                          setError("終了日は開始日以降の日付を指定してください");
                          return;
                        }

                        setIsSaving(true);
                        setError(null);
                        setMessage(null);

                        try {
                          const res = await authFetch(
                            `/cycles/${openCycle.cycle_id}`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                start_date: startDraft,
                                end_date: null,
                              }),
                            }
                          );

                          if (!res.ok) {
                            throw new Error(
                              `PATCH /cycles/{id} failed: ${res.status}`
                            );
                          }

                          await fetchCycles();
                          setMessage(`開始日（${startDraft}）を更新しました`);
                          setIsEditingStart(false);
                          prevStartBeforeEditRef.current = startDraft;
                        } catch (e) {
                          console.error(e);
                          setStartDraft(prevStartRef.current);
                          setEndDraft(prevEndRef.current);
                          setError("開始日の更新に失敗しました");
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      className="px-3 py-2 rounded-lg border text-xs font-semibold disabled:opacity-60"
                      style={{
                        borderColor: UI.border,
                        backgroundColor: UI.bad,
                        color: UI.title,
                      }}
                    >
                      開始日を更新
                    </button>
                  </div>
                )}
              </label>

              <label className="space-y-1">
                <p className="text-[11px]" style={{ color: UI.sub }}>
                  終了日
                </p>
                <input
                  type="date"
                  value={endDraft}
                  max={today}
                  onChange={(e) => setEndDraft(e.target.value)}
                  disabled={!openCycle || isEditingStart}
                  className={`w-full rounded-xl border px-3 py-3 text-sm font-semibold disabled:opacity-60 ${
                    isEditingStart ? "cursor-not-allowed" : ""
                  }`}
                  style={{
                    borderColor: UI.border,
                    backgroundColor: UI.bg,
                    color: UI.text,
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSaving || !!openCycle || !startDraft}
                onClick={async () => {
                  prevStartRef.current = startDraft;
                  prevEndRef.current = endDraft;

                  if (!startDraft) {
                    setError("開始日を入力してください");
                    return;
                  }
                  if (startDraft > today) {
                    setError("開始日は未来の日付を指定できません");
                    return;
                  }

                  setIsSaving(true);
                  setError(null);
                  setMessage(null);

                  try {
                    const res = await authFetch("/cycles", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ start_date: startDraft, end_date: null }),
                    });
                    if (!res.ok)
                      throw new Error(`POST /cycles failed: ${res.status}`);
                    await fetchCycles();
                    setMessage(`開始日（${startDraft}）を登録しました`);
                  } catch (e) {
                    console.error(e);
                    setStartDraft(prevStartRef.current);
                    setEndDraft(prevEndRef.current);
                    setError("開始日の登録に失敗しました（未終了がある等）");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="py-2.5 rounded-xl text-xs font-semibold border disabled:opacity-60"
                style={
                  openCycle
                    ? {
                        borderColor: UI.border,
                        backgroundColor: UI.bg,
                        color: UI.sub,
                      }
                    : {
                        borderColor: UI.border,
                        backgroundColor: UI.bad,
                        color: UI.text,
                      }
                }
              >
                開始日を登録
              </button>

              <button
                type="button"
                disabled={isSaving || !openCycle || !endDraft || isEditingStart}
                onClick={async () => {
                  prevStartRef.current = startDraft;
                  prevEndRef.current = endDraft;

                  if (!endDraft) {
                    setError("終了日を入力してください");
                    return;
                  }
                  if (endDraft > today) {
                    setError("終了日は未来の日付を指定できません");
                    return;
                  }
                  if (startDraft && endDraft < startDraft) {
                    setError("終了日は開始日以降の日付を指定してください");
                    return;
                  }

                  setIsSaving(true);
                  setError(null);
                  setMessage(null);

                  try {
                    const res = await authFetch("/cycles/end", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ end_date: endDraft }),
                    });
                    if (!res.ok)
                      throw new Error(`PATCH /cycles/end failed: ${res.status}`);
                    await fetchCycles();
                    setMessage(`終了日（${endDraft}）を登録しました`);
                  } catch (e) {
                    console.error(e);
                    setStartDraft(prevStartRef.current);
                    setEndDraft(prevEndRef.current);
                    setError("終了日の登録に失敗しました（未終了が無い等）");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="py-2.5 rounded-xl text-xs font-semibold border disabled:opacity-60"
                style={
                  openCycle && !isEditingStart
                    ? {
                        borderColor: UI.border,
                        backgroundColor: UI.bad,
                        color: UI.title,
                      }
                    : {
                        borderColor: UI.border,
                        backgroundColor: UI.bg,
                        color: UI.sub,
                      }
                }
              >
                終了日を登録
              </button>
            </div>
          </div>
        </section>

        {/* ✅ 直近の生理ログもカードへ（影つき） */}
        <section>
          <div
            className="rounded-2xl border p-4 space-y-3 shadow-sm"
            style={{ borderColor: UI.border, backgroundColor: UI.bg }}
          >
            <div className="space-y-1">
              <p className="text-[15px] font-semibold" style={{ color: UI.title }}>
                直近の生理ログ
              </p>
              <p className="text-[11px]" style={{ color: UI.sub }}>
                直近3件まで編集できます
              </p>
            </div>

            <div className="space-y-3">
              {cycles
                .filter((c) => c.end_date !== null)
                .slice(0, 3)
                .map((c) => (
                  <PastCycleCard
                    key={c.cycle_id}
                    cycle={c}
                    isSaving={isSaving}
                    onUpdated={fetchCycles}
                  />
                ))}
              {cycles.filter((c) => c.end_date !== null).length === 0 && (
                <p className="text-xs" style={{ color: UI.sub }}>
                  まだ完了ログがありません
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
