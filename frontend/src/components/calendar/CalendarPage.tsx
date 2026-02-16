//src/components/calendar/CalendarPage.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "@/lib/api";
import CalendarHeader from "./CalendarHeader";
import MonthControls from "./MonthControls";
import WeekdayRow from "./WeekdayRow";
import CalendarGrid from "./CalendarGrid";
import { formatYmdLocal } from "@/lib/date";//日付
import RecordModal from "@/components/records/RecordModal";

type DailySummary = {
  sleepQuality: number;
  stressLevel: number;
  skinCondition: number;
  skincareEffort: number;
  memo: string;
  prefecture: string;
};

type PrefectureItem = {
  pref_code: string | number;
  name_ja: string;
};

type RecordItem = {
  date: string;
  sleep?: number | null;
  stress?: number | null;
  skin_condition?: number | null;
  skincare_effort?: number | null;
  memo?: string | null;
  prefecture_code?: string | number | null;
  prefecture?: string | number | null;
  env_pref_code?: string | number | null;
};

type CycleItem = {
  start_date?: string | null;
  end_date?: string | null;
};
type CalendarDay = {
  date: Date;
  inCurrentMonth: boolean;
};

function parseYmdToLocalDate(ymd: string): Date {
  
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function isValidYmd(ymd: string | null | undefined): ymd is string {
  return !!ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd);
}

export default function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  type SortCategory = "none" | "sleep" | "stress" | "skincare";
  type SortDirection = "good" | "bad";

   type SortState =
   | { category: "none"; direction: null }    | { category: Exclude<SortCategory, "none">; direction: SortDirection };
 
  const [sortState, setSortState] = useState<SortState>({
    category: "none",
    direction: null,
  });

  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isToneOpen, setIsToneOpen] = useState(false);


  // 表示中の年月（初期値＝今日の月の1日）
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);


  // 月別に取得した日次記録
  const [recordsByDate, setRecordsByDate] = useState<
    Record<string, DailySummary>
  >({});

  // 🩸 cycle_log から算出した「生理中」の日付セット（YYYY-MM-DD => true）
  const [menstruationByDate, setMenstruationByDate] = useState<
    Record<string, boolean>
  >({});

  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-11

  // 🗾 都道府県コード → 都道府県名 の対応表
  const [prefMap, setPrefMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const res = await authFetch("/prefectures", {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = await res.json();
        const m: Record<string, string> = {};

        (data.prefectures ?? []).forEach((p: PrefectureItem) => {
          m[String(p.pref_code)] = p.name_ja;
        });

        setPrefMap(m);
      } catch (e) {
        console.error(e);
      }
    };

    fetchPrefs();
  }, []);

  useEffect(() => {
    const openRecord = searchParams.get("openRecord");
    const dateParam = searchParams.get("date");
    if (!openRecord || !isValidYmd(dateParam)) return;

    const target = parseYmdToLocalDate(dateParam);
    setCurrentMonth(new Date(target.getFullYear(), target.getMonth(), 1));
    setSelectedDate(target);
  }, [searchParams]);

  // 🔁 指定された月の範囲で日次記録を取得
  useEffect(() => {
    const fetchMonthlyRecords = async () => {
      setIsLoading(true);
      setFetchError(null);

      try {
        const from = formatYmdLocal(new Date(year, month, 1));
        const lastDayOfMonth = new Date(year, month + 1, 0);
        let to = formatYmdLocal(lastDayOfMonth);

        
        const todayYmd = formatYmdLocal(new Date());

        // 月全体が未来の場合は取得しない（カレンダーは表示するが、記録は無し）
        if (from > todayYmd) {
          setRecordsByDate({});
          return;
        }

        // end_date が未来なら today に丸める
        if (to > todayYmd) {
          to = todayYmd;
        }

        const res = await authFetch(
          `/records?start_date=${from}&end_date=${to}`,
          { method: "GET", cache: "no-store" }
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch records: ${res.status}`);
        }

        const data = await res.json();
        const map: Record<string, DailySummary> = {};

        const records = Array.isArray(data.records) ? data.records : [];

        records.forEach((r: RecordItem) => {
          const key = r.date;
          if (!key) return;

          map[key] = {
            sleepQuality: r.sleep ?? 0,
            stressLevel: r.stress ?? 0,
            skinCondition: r.skin_condition ?? 0,
            skincareEffort: r.skincare_effort ?? 0,
            memo: r.memo ?? "",
            prefecture: String(
              r.prefecture_code ?? r.prefecture ?? r.env_pref_code ?? ""
            ),
          };
        });

        setRecordsByDate(map);
      } catch (error) {
        console.error(error);
        setFetchError("日次記録の取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMonthlyRecords();
  }, [year, month]);

  // 🩸 cycle_log を取得して「開始日〜終了日（未終了は today または月末まで）」で生理バッジを出す
  useEffect(() => {
    const fetchMenstruationFromCycles = async () => {
      try {
        const fromYmd = formatYmdLocal(new Date(year, month, 1));
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const toYmd = formatYmdLocal(lastDayOfMonth);

        const fromDate = parseYmdToLocalDate(fromYmd);
        const toDate = parseYmdToLocalDate(toYmd);

        const todayYmd = formatYmdLocal(new Date());
        const todayDate = parseYmdToLocalDate(todayYmd);

        // API は現状「期間指定」できないので多めに取る（未終了は最大1件の前提）
        const res = await authFetch("/cycles?limit=50", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          // 失敗してもカレンダーは死なない（バッジが出ないだけ）
          setMenstruationByDate({});
          return;
        }

        const json = await res.json();
        const cycles = Array.isArray(json?.cycles) ? json.cycles : [];

        const m: Record<string, boolean> = {};

        cycles.forEach((c: CycleItem) => {
          const startYmd = c?.start_date;
          const endYmd = c?.end_date;
          if (!isValidYmd(startYmd)) return;

          const cycleStart = parseYmdToLocalDate(startYmd);

          // end_date が無い（未終了）場合：today まで。ただし表示月より先には塗らない
          const cycleEnd = isValidYmd(endYmd)
            ? parseYmdToLocalDate(endYmd)
            : todayDate < toDate
              ? todayDate
              : toDate;

          // 表示月の範囲にクリップ
          const start = cycleStart > fromDate ? cycleStart : fromDate;
          const end = cycleEnd < toDate ? cycleEnd : toDate;

          if (end < start) return;

          // start〜end を1日ずつ埋める（inclusive）
          const cur = new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate()
          );
          while (cur <= end) {
            m[formatYmdLocal(cur)] = true;
            cur.setDate(cur.getDate() + 1);
          }
        });

        setMenstruationByDate(m);
      } catch (e) {
        console.error(e);
        setMenstruationByDate({});
      }
    };

    fetchMenstruationFromCycles();
  }, [year, month]);

  // カレンダー用の日付リストを作る
  const days: CalendarDay[] = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0); // 次の月の0日＝前月末

    const firstWeekday = firstDayOfMonth.getDay(); // 0=日,6=土
    const daysInMonth = lastDayOfMonth.getDate();

    const result: CalendarDay[] = [];

    // 前月の埋め草
    if (firstWeekday > 0) {
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = firstWeekday - 1; i >= 0; i--) {
        const d = prevMonthLastDay - i;
        result.push({
          date: new Date(year, month - 1, d),
          inCurrentMonth: false,
        });
      }
    }

    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({
        date: new Date(year, month, d),
        inCurrentMonth: true,
      });
    }

    // 次月の埋め草（6行分揃えたいので42マスを目安に）
    while (result.length < 42) {
      const last = result[result.length - 1].date;
      const next = new Date(
        last.getFullYear(),
        last.getMonth(),
        last.getDate() + 1
      );
      result.push({
        date: next,
        inCurrentMonth: false,
      });
    }

    return result;
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
  };

  const isSameDay = (a: Date, b: Date | null) => {
    if (!b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

  const monthLabel = `${year}.${String(month + 1).padStart(2, "0")}`;
  const selectedLabel = selectedDate
  ? formatYmdLocal(selectedDate)
  : "未選択";

  const selectedDateKey = selectedDate ? formatYmdLocal(selectedDate) : null;

  const selectedRecord =
    selectedDateKey && recordsByDate[selectedDateKey]
      ? recordsByDate[selectedDateKey]
      : null;

 const isNone = sortState.category === "none";
 const ACTIVE_PINK_BG = "bg-[#E6B9BF]";      // ← 好きなピンクに変えてOK
 const ACTIVE_PINK_BORDER = "border-[#E6B9BF]";


  return (
    <div className="min-h-[100dvh] bg-[#FDFCFC] flex flex-col">
      {/* <CalendarHeader title="カレンダー" /> */}

      <main className="flex-1 min-h-0 px-4 pt-6 pb-4 flex flex-col gap-3 overflow-hidden">
        <MonthControls
          label={monthLabel}
          onPrev={handlePrevMonth}
          onNext={handleNextMonth}
        />

        {/* ▼ここに一旦置く（後で右上に移動してOK） */}
        <div className="flex justify-end">
          <div className="flex items-center gap-2">
            {/* 左：カテゴリ（初期はこれ1個だけ） */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={() => {
                  setIsCategoryOpen((v) => !v);
                  setIsToneOpen(false);
                }}
                className={[
                  "h-8 px-3 rounded-full text-[11px] font-medium border whitespace-nowrap",
                  isNone
                    ? "bg-[#FDFCFC] border-[#E6E7EB] text-[#596377]"
                    : `${ACTIVE_PINK_BG} ${ACTIVE_PINK_BORDER} text-white`,
                ].join(" ")}
              >
                {sortState.category === "none"
                  ? "絞り込みなし"
                  : sortState.category === "sleep"
                    ? "睡眠"
                    : sortState.category === "stress"
                      ? "ストレス"
                      : "スキンケア"}
              </button>

              {isCategoryOpen && (
                <>
                  {/* クリック外で閉じる */}
                  <div
                    className="fixed inset-0 z-40"
                    onMouseDown={() => setIsCategoryOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-[#E6E7EB] bg-white shadow-lg overflow-hidden z-50">
                    {(
                      [
                        { key: "none", label: "絞り込みなし" },
                        { key: "sleep", label: "睡眠" },
                        { key: "stress", label: "ストレス" },
                        { key: "skincare", label: "スキンケア" },
                      ] as const
                    ).map((item) => {
                      const active = sortState.category === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onMouseDown={() => {
                            if (item.key === "none") {
                              setSortState({
                                category: "none",
                                direction: null,
                              });
                              setIsToneOpen(false);
                            } else {
                              setSortState({
                                category: item.key,
                                direction: "good",
                              }); // 選んだ瞬間にGoodが立つ
                            }
                            setIsCategoryOpen(false);
                          }}
                          className={[
                            "w-full flex items-center gap-2 px-3 py-2 text-left text-[12px]",
                            "hover:bg-[#FFF1F3]",
                          ].join(" ")}
                        >
                          <span
                            className={
                              active ? "text-[#596377]" : "text-transparent"
                            }
                          >
                            ✓
                          </span>
                          <span className="text-[#596377]">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* 右：Good/Bad（カテゴリ選択したときだけピョコッ） */}
            <div
              className={[
                "relative transition-all duration-200 ease-out",
                sortState.category === "none"
                  ? "max-w-0 opacity-0"
                  : "max-w-[120px] opacity-100",
              ].join(" ")}
              aria-hidden={sortState.category === "none"}
            >
              <button
                type="button"
                disabled={sortState.category === "none"}
                onMouseDown={() => {
                  if (sortState.category === "none") return;
                  setIsToneOpen((v) => !v);
                  setIsCategoryOpen(false);
                }}
                className="h-8 px-3 rounded-full text-[11px] font-semibold border bg-[#FDFCFC] border-[#E6E7EB] text-[#596377] hover:bg-[#FFF1F3] whitespace-nowrap"
              >
                {sortState.direction === "good" ? "Good" : "Bad"}
              </button>

              {isToneOpen && sortState.category !== "none" && (
                <>
                  {/* クリック外で閉じる */}
                  <div
                    className="fixed inset-0 z-40"
                    onMouseDown={() => setIsToneOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-28 rounded-xl border border-[#E6E7EB] bg-white shadow-lg overflow-hidden z-50">
                    {(["good", "bad"] as const).map((dir) => {
                      const active = sortState.direction === dir;
                      return (
                        <button
                          key={dir}
                          type="button"
                          onMouseDown={() => {
                            setSortState({
                              category: sortState.category,
                              direction: dir,
                            });
                            setIsToneOpen(false);
                          }}
                          className={[
                            "w-full flex items-center gap-2 px-3 py-2 text-left text-[12px]",
                            "hover:bg-[#FFF1F3]",
                          ].join(" ")}
                        >
                          <span
                            className={
                              active ? "text-[#596377]" : "text-transparent"
                            }
                          >
                            ✓
                          </span>

                          <span className="text-[#596377]">
                            {dir === "good" ? "Good" : "Bad"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <WeekdayRow />
          </div>
        </div>

        {/* ✅ 伸びる領域：でも“伸びすぎない” */}
        <div className="flex-1 min-h-0 flex justify-center">
          <div className="w-full max-w-md h-[56vh] max-h-[520px] min-h-[360px]">
            <CalendarGrid
              days={days}
              selectedDate={selectedDate}
              recordsByDate={recordsByDate}
              menstruationByDate={menstruationByDate}
              sortState={sortState}
              onSelectDate={setSelectedDate}
            />
          </div>
        </div>

        {selectedDate && (
          <RecordModal
            date={selectedDate}
            initialSummary={recordsByDate[formatYmdLocal(selectedDate)]}
            onClose={() => setSelectedDate(null)}
            onSaved={async () => {
              const ymd = formatYmdLocal(selectedDate);
              try {
                const res = await authFetch(`/records/${ymd}`, {
                  method: "GET",
                  cache: "no-store",
                });

                if (res.status === 404) {
                  // もし何らかの理由でレコードが無い扱いなら、その日のメモを消す
                  setRecordsByDate((prev) => {
                    const next = { ...prev };
                    delete next[ymd];
                    return next;
                  });
                } else if (res.ok) {
                  const r = await res.json();

                  // 月取得と同じ変換ルールで1日分を更新
                  const updated: DailySummary = {
                    sleepQuality: r.sleep ?? 0,
                    stressLevel: r.stress ?? 0,
                    skinCondition: r.skin_condition ?? 0,
                    skincareEffort: r.skincare_effort ?? 0,
                    memo: r.memo ?? "",
                    prefecture: String(
                      r.prefecture_code ?? r.prefecture ?? r.env_pref_code ?? ""
                    ),
                  };

                  setRecordsByDate((prev) => ({
                    ...prev,
                    [ymd]: updated,
                  }));
                }
              } catch (e) {
                console.error(e);
                // ここは失敗しても閉じたいなら何もしないでOK（必要ならトースト出す）
              } finally {
                setSelectedDate(null);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
