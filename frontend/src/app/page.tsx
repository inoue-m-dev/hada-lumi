//src/app/page.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { TickItemTextProps } from "recharts/types/polar/PolarAngleAxis";
import { authFetch } from "@/lib/api";

// ========= 共通ヘルパー =========
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function clampScore(value: number | null): number | null {
  if (value === null) return null;
  return Math.min(5, Math.max(1, value));
}

// ========= 型定義 =========
type RadarMetricKey =
  | "sleep"
  | "stress"
  | "skincare_effort"
  | "menstrual"
  | "climate"
  | "skin_condition";

type RadarChartApiResponse = {
  period_average: Record<RadarMetricKey, number> | null;
  problem_days_average: Record<RadarMetricKey, number> | null;
  problem_dates: string[];
};

type RadarChartRow = {
  key: Exclude<RadarMetricKey, "skin_condition">;
  label: string;
  period: number | null;
  problem: number | null;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

function renderRadarTick(props: TickItemTextProps) {
  const { payload, x, y, cx, cy } = props;
  const xNum = toNumber(x) ?? 0;
  const yNum = toNumber(y) ?? 0;
  const cxNum = toNumber(cx);
  const cyNum = toNumber(cy);
  const label = payload?.value ?? "";

  if (cxNum === null || cyNum === null) {
    return (
      <text
        x={xNum}
        y={yNum}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={13}
        fill="#596377"
        fontWeight={500}
      >
        {label}
      </text>
    );
  }

  const dx = xNum - cxNum;
  const dy = yNum - cyNum;
  const scale = 1.04;
  const nx = cxNum + dx * scale;
  const ny = cyNum + dy * scale;
  const anchor = dx > 8 ? "start" : dx < -8 ? "end" : "middle";

  return (
    <text
      x={nx}
      y={ny}
      textAnchor={anchor}
      dominantBaseline="middle"
      fontSize={14}
      fill="#596377"
      fontWeight={500}
    >
      {label}
    </text>
  );
}

const METRIC_LABELS: Record<Exclude<RadarMetricKey, "skin_condition">, string> = {
  stress: "ストレス",
  sleep: "睡眠",
  skincare_effort: "スキンケア",
  menstrual: "ホルモン",
  climate: "気候",
};

type AIAnalysisRequest = {
  target_date: string; // "YYYY-MM-DD"
  problem_dates?: string[];
};

type AIAnalysisResponse = {
  ai_id: string;
  user_id: string;
  date: string;
  root_cause: string;
  advice: string | null;
  analysis_raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

// ========= AI分析セクション =========
type AiAnalysisSectionProps = {
  date: string;
  problemDates: string[];
};

function AiAnalysisSection({ date, problemDates }: AiAnalysisSectionProps) {
  const [result, setResult] = useState<AIAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAiHelpOpen, setIsAiHelpOpen] = useState(false);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);

    const payload: AIAnalysisRequest = {
      target_date: date,
      ...(problemDates.length > 0 ? { problem_dates: problemDates } : {}),
    };

    try {
      const res = await authFetch("/dashboard/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 422) {
          throw new Error("日付の形式が正しくありません（YYYY-MM-DD 想定）");
        }
        throw new Error(`AI分析に失敗しました（${res.status}）`);
      }

      const json: AIAnalysisResponse = await res.json();
      setResult(json);
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "AI分析の呼び出しに失敗しました";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <p className="text-base font-semibold text-[#574143]">AI分析結果とアドバイス</p>
      {/* ✅ カード内を縦flexにして、ボタンを常に最下部へ */}
      <div className="rounded-xl border border-[#E6E7EB] bg-[#FDFCFC] p-3 shadow-sm">
        {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
          <div className="min-h-[150px] flex flex-col gap-1 mt-1">
          {/* 上側：結果表示 */}
          <div className="space-y-4">
            {result ? (
              <>
                <div className="flex items-start gap-3">
                  {/*楕円背景🔍️*/}
                  <div className="h-9 w-9 rounded-full bg-[#ffe3e5] flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#596377]"
                    >
                      <path d="m21 21-4.34-4.34" />
                      <circle cx="11" cy="11" r="8" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <p className="text-[11px] font-semibold text-[#B4B7C0]">
                        肌ゆらぎ原因のヒント
                      </p>
                      <button
                        type="button"
                        aria-label="肌ゆらぎ原因のヒントの説明"
                        aria-expanded={isAiHelpOpen}
                        onClick={() => setIsAiHelpOpen((open) => !open)}
                        onBlur={() => setIsAiHelpOpen(false)}
                        className="relative flex h-5 w-5 items-center justify-center rounded-full border border-[#E6E7EB] text-[10px] text-[#B4B7C0]"
                      >
                        ?
                        {isAiHelpOpen && (
                          <span className="pointer-events-none absolute left-0 top-6 z-10 w-[240px] rounded-lg border border-[#E6E7EB] bg-white px-2 py-1.5 text-[10px] text-[#596377] shadow-sm">
                            直近7日と過去30日の記録から“揺らぎやすい傾向”をまとめたものです。レーダーチャートの数値そのものではなく、傾向のまとめとして読んでください。
                          </span>
                        )}
                      </button>
                    </div>
                    <p className="text-sm leading-relaxed text-[#596377] whitespace-pre-line">
                      {result.root_cause}
                    </p>
                  </div>
                </div>

                {result.advice && (
                  <div className="flex items-start gap-3">
                    {/*楕円背景✔*/}
                    <div className="h-9 w-9 rounded-full bg-[#ffe3e5] flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[#596377]"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-[#B4B7C0]">
                        今日の簡単ケア
                      </p>
                      <p className="text-sm leading-relaxed text-[#596377] whitespace-pre-line">
                        {result.advice}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              !loading && (
                <div className="flex items-start gap-3 pb-3">
                  <div className="h-9 w-9 rounded-full bg-[#ffe3e5] flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#596377]"
                    >
                      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                      <path d="M9 18h6" />
                      <path d="M10 22h4" />
                    </svg>
                  </div>
                  <p className="text-sm leading-relaxed text-[#596377]">
                    ここにAIの分析結果が表示されます。「AI分析する」を押すと、あなたのデータを使った具体的な原因とケアを生成します。
                  </p>
                </div>
              )
            )}
          </div>

          {/* 下側：ボタン（常に一番下） */}
          <div className="mt-0">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full rounded-full bg-[#EBCFD1] px-4 py-3 text-sm font-semibold text-[#596377] shadow-sm hover:bg-[#D7A7AB] active:bg-[#CE9A9F] disabled:opacity-60"
            >
              {loading ? "分析中…" : "AI分析する"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ========= HomePage =========
export default function HomePage() {
  const { todayStr, startStr } = useMemo(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 6);
    return { todayStr: formatDate(today), startStr: formatDate(start) };
  }, []);

  const [radarData, setRadarData] = useState<RadarChartRow[]>([]);
  const [radarLoading, setRadarLoading] = useState(false);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [problemDates, setProblemDates] = useState<string[]>([]);
  const [skinScorePercent, setSkinScorePercent] = useState<number | null>(null);
  const [isRadarHelpOpen, setIsRadarHelpOpen] = useState(false);
  const [isSkinScoreHelpOpen, setIsSkinScoreHelpOpen] = useState(false);

  useEffect(() => {
    async function fetchRadar() {
      setRadarLoading(true);
      setRadarError(null);

      try {
        const url = `/dashboard/radar-chart?start_date=${startStr}&end_date=${todayStr}`;
        const res = await authFetch(url);
        if (!res.ok) throw new Error(`取得に失敗しました（${res.status}）`);

        const json: RadarChartApiResponse = await res.json();

        if (!json.period_average && !json.problem_days_average) {
          setProblemDates([]);
          setSkinScorePercent(null);
          setRadarData([]);
          return;
        }

        setProblemDates(json.problem_dates ?? []);

        const skinCondition = json.period_average?.skin_condition ?? null;
        if (typeof skinCondition === "number") {
          const percent = Math.round((skinCondition / 5) * 100);
          setSkinScorePercent(percent);
        } else {
          setSkinScorePercent(null);
        }

        const keys = Object.keys(METRIC_LABELS) as Array<
          Exclude<RadarMetricKey, "skin_condition">
        >;

        const rows: RadarChartRow[] = keys.map((key) => ({
          key,
          label: METRIC_LABELS[key],
          period: clampScore(
            json.period_average ? json.period_average[key] ?? null : null,
          ),
          problem: clampScore(
            json.problem_days_average ? json.problem_days_average[key] ?? null : null,
          ),
        }));

        setRadarData(rows);
      } catch (err: unknown) {
        console.error(err);
        setRadarError(
          err instanceof Error ? err.message : "レーダーチャートの取得に失敗しました",
        );
        setProblemDates([]);
        setSkinScorePercent(null);
        setRadarData([]);
      } finally {
        setRadarLoading(false);
      }
    }

    fetchRadar();
  }, [startStr, todayStr]);

  return (
    <div className="h-full flex flex-col bg-[#FDFCFC]">
      {/* <header className="px-4 py-3 border-b border-[#E0D8D2] bg-[#FDFBF9]">
        <h1 className="text-base font-semibold text-[#171412]">ホーム</h1>
      </header> */}

      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#FDFCFC]">
        <section className="space-y-1">
          <p className="text-base font-semibold text-[#574143]">今週の分析</p>
          {/* <p className="text-[11px] text-[#B59A92]">
            肌スコアは直近7日平均（skin_condition）を%表示にしたものです。
          </p> */}
        </section>

        {/*肌スコアバー*/}
        <section className="rounded-2xl bg-[#FDFCFC] border border-[#E6E7EB] px-4 py-2 space-y-3 shadow-sm">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold text-[#574143]">肌スコア</p>
                <button
                  type="button"
                  aria-label="肌スコアの説明"
                  aria-expanded={isSkinScoreHelpOpen}
                  onClick={() => setIsSkinScoreHelpOpen((open) => !open)}
                  onBlur={() => setIsSkinScoreHelpOpen(false)}
                  className="relative flex h-5 w-5 items-center justify-center rounded-full border border-[#E6E7EB] text-[10px] text-[#B4B7C0]"
                >
                  ?
                  {isSkinScoreHelpOpen && (
                    <span className="pointer-events-none absolute left-0 top-6 z-10 w-[210px] rounded-lg border border-[#E6E7EB] bg-white px-2 py-1.5 text-[10px] text-[#596377] shadow-sm">
                      肌スコアは直近7日の肌状態スコアの平均値を%表示にしたものです。
                    </span>
                  )}
                </button>
              </div>
              <p className="text-2xl font-semibold text-[#596377]">
                {skinScorePercent === null ? "—" : `${skinScorePercent}%`}
              </p>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-[#E6E7EB] overflow-hidden">
            <div
              className="h-full bg-[#EBCFD1]"
              style={{ width: `${skinScorePercent ?? 0}%` }}
            />
          </div>
        </section>

        <section className="rounded-2xl bg-[#FDFCFC] border border-[#E6E7EB] px-3 py-2 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-[#574143]">今週のバランス</p>
            <button
              type="button"
              aria-label="今週のバランスの説明"
              aria-expanded={isRadarHelpOpen}
              onClick={() => setIsRadarHelpOpen((open) => !open)}
              onBlur={() => setIsRadarHelpOpen(false)}
              className="relative flex h-5 w-5 items-center justify-center rounded-full border border-[#E6E7EB] text-[10px] text-[#B4B7C0]"
            >
              ?
              {isRadarHelpOpen && (
                <span className="pointer-events-none absolute left-0 top-6 z-10 w-[210px] rounded-lg border border-[#E6E7EB] bg-white px-2 py-1.5 text-[10px] text-[#596377] shadow-sm">
                睡眠・ストレス・スキンケア・ホルモン・気候（5項目）のスコアの直近７日間の平均値を表示します。肌不調日は、直近7日間で肌状態が悪かった日における、各項目のスコアの平均値です。
                </span>
              )}
            </button>
          </div>

          {radarLoading && (
            <p className="text-[11px] text-[#7F7066]">
              レーダーチャート読み込み中...
            </p>
          )}
          {radarError && (
            <p className="text-[11px] text-red-500">{radarError}</p>
          )}

          {!radarLoading && !radarError && radarData.length === 0 && (
            <p className="text-[14px] text-[#7F7066]">
              直近7日間の記録が無い為、レーダーチャートを表示できません。記録をしてみて下さいね。
            </p>
          )}

          {!radarLoading && !radarError && radarData.length > 0 && (
            <div className="flex items-center justify-center">
              <div className="w-[300px] h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={radarData}
                    outerRadius="84%"
                    margin={{ top: 4, right: 16, bottom: 0, left: 16 }}
                  >
                    <PolarGrid stroke="#D9DDE4" strokeWidth={1.4} />
                    <PolarAngleAxis
                      dataKey="label"
                      tick={renderRadarTick}
                    />
                    <PolarRadiusAxis domain={[1, 5]} tick={false} axisLine={false} />
                    <Radar
                      name="全体平均"
                      dataKey="period"
                      stroke="#596377"
                      fill="#596377"
                      fillOpacity={0.18}
                    />
                    <Radar
                      name="肌不調日"
                      dataKey="problem"
                      stroke="#D19EA3"
                      fill="#EBCFD1"
                      fillOpacity={0.32}
                      strokeWidth={2}
                    />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: "11px", paddingTop: "2px" }}
                      formatter={(value, entry) => (
                        <span style={{ color: entry.color, fontWeight: 500 }}>
                          {value}
                        </span>
                      )}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>

        <AiAnalysisSection date={todayStr} problemDates={problemDates} />
      </main>
    </div>
  );
}
