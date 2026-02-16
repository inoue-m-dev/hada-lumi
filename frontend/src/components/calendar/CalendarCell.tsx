// frontend/src/components/calendar/CalendarCell.tsx
"use client";

import React from "react";
import { PiPencilFill } from "react-icons/pi";
import { MenstruationIcon } from "@/lib/metricsVisual";

type SortCategory = "none" | "sleep" | "stress" | "skincare";
type SortDirection = "good" | "bad";
type SortState =
  | { category: "none"; direction: null }
  | { category: Exclude<SortCategory, "none">; direction: SortDirection };



type DailySummary = {
  sleepQuality: number;
  stressLevel: number;
  skinCondition: number;
  skincareEffort: number;
  memo?: string;
  prefecture?: string;
};

type Props = {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  summary?: DailySummary;
  hasMenstruation: boolean;
  sortState: SortState;
  onSelectDate: (date: Date) => void;
};

function clampScore(v: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = typeof v === "number" ? v : Number(v);
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as 1 | 2 | 3 | 4 | 5;
}

// デモの雰囲気: 肌状態で背景トーン
function getSkinToneBg(skinCondition: unknown) {
  const s = clampScore(skinCondition);
  // 1-2: bad (#EBCFD1), 3: neutral（#FFE3E5）, 4-5: good (#FFF1F3)
  if (s <= 2) return "bg-[#EBCFD1]";
  if (s === 3) return "bg-[#FFE3E5]";
  return "bg-[#fff1f3]";
}

function getSkinToneText(skinCondition: unknown) {
  const s = clampScore(skinCondition);
  return s <= 2 ? "text-white" : "text-[#596378]";
}

// デモのルール: 3は非表示、<=2は赤、>=4は青灰
function getHealthColor(score: unknown) {
  const s = clampScore(score);
  if (s <= 2) return "text-[#962a83]";
  if (s >= 4) return "text-[#fa98e9]";
  return "text-stone-400";
}

// ✎アイコン
//react-icons使用 ({showPencil)

// 地図マーク（布石。表示条件はあとで差し替え）
function PinIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 外枠 */}
      <path d="M12 22s7-7.2 7-12.1A7 7 0 1 0 5 9.9C5 14.8 12 22 12 22Z" />
      {/* 中の丸 */}
      <circle cx="12" cy="9.9" r="2.4" />
    </svg>
  );
}

//zzzアイコン
function SleepIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* 大きいZ */}
     <path
        d="M4.2 14.4c0-.55.45-1 1-1h7.6c.42 0 .8.26.94.66.14.4.04.84-.26 1.14L8.35 20h4.45c.55 0 1 .45 1 1s-.45 1-1 1H5.2c-.42 0-.8-.26-.94-.66-.14-.4-.04-.84.26-1.14L9.65 15.4H5.2c-.55 0-1-.45-1-1Z"
        fill="currentColor"
      />
      {/* 小さいZ */}
      <path
        d="M12.4 6.2c0-.5.4-.9.9-.9h6.1c.38 0 .72.24.84.6.13.36.04.76-.23 1.03l-3.88 3.87h3.57c.5 0 .9.4.9.9s-.4.9-.9.9h-6.1c-.38 0-.72-.24-.84-.6-.13-.36-.04-.76.23-1.03l3.88-3.87H13.3c-.5 0-.9-.4-.9-.9Z"
        fill="currentColor"
        opacity="0.95"
      />
    </svg>
  );
}
//ストレスアイコン
function StressIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8a8 8 0 0 1-8 8Z" />
      <path d="M11 20c0-2.5 2-5 2-5" />
      <path d="M11 20H2" />
    </svg>
  );
}
//スキンケアアイコン
function SkincareIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3h12l4 6-10 12L2 9Z" />
      <path d="M11 3 8 9l3 12" />
      <path d="M13 3l3 6-3 12" />
      <path d="M2 9h20" />
    </svg>
  );
}

export default function CalendarCell({
  date,
  inCurrentMonth,
  isToday,
  isSelected,
  summary,
  hasMenstruation,
  sortState,
  onSelectDate,
}: Props) {


  const day = date.getDate();

  // 記録がない日でも「セルの見た目」は崩さない
  const skinBg = summary ? getSkinToneBg(summary.skinCondition) : "bg-white";
  const textColor = summary
    ? getSkinToneText(summary.skinCondition)
    : "text-[#596378]";

  const disabled = !inCurrentMonth;
  const base =
  "relative w-full h-full rounded-[1rem] transition-all duration-200 select-none";

  const interaction = disabled
    ? "opacity-40 pointer-events-none"
    : "cursor-pointer hover:opacity-95 hover:scale-[1.02] active:scale-[0.98]";

  // 選択: デモっぽく“ふわっと強調”
  const selectedRing = isSelected
    ? "ring-2 ring-[#596378]/35 shadow-sm"
    : "shadow-sm";
  const todayRing = isToday && !isSelected ? "ring-1 ring-[#596378]/25" : "";

function isIconVisible(
  summary: DailySummary | undefined,
  sortState: SortState,
  metric: "sleep" | "stress" | "skincare"
) {
  if (!summary) return false;

  const scoreMap = {
    sleep: summary.sleepQuality,
    stress: summary.stressLevel,
    skincare: summary.skincareEffort,
  };

  const score = Number(scoreMap[metric]); // 念のため数値化

  // score=3は常に非表示（デモと同じ）
  if (score === 3) return false;

  // ✅ category=none のときは「全部表示（3以外）」で確定（direction無視）
  if (sortState.category === "none") return true;

  // category指定があるなら一致しないものは消す
  if (sortState.category !== metric) return false;

  // good/bad（category指定があるときだけ効く）
  if (sortState.direction === "good") return score >= 4;
  return score <= 2;
}



         return (
    <button
      type="button"
      onClick={() => onSelectDate(date)}
      className={[
        base,
        skinBg,
        textColor,
        interaction,
        selectedRing,
        todayRing,
      ].join(" ")}
    >
      {/* 左上: 日付 + 生理☾ */}
      <div className="absolute top-2 left-2 flex items-center">
        <span className="text-[11px] font-bold tabular-nums opacity-90 leading-none text-[#596378]">
          {day}
        </span>

        {hasMenstruation && (
          <MenstruationIcon
            size={12}
            strokeWidth={2}
            className="ml-1.5 opacity-60 text-[#596378]"
            aria-hidden="true"
          />
        )}
      </div>

      {/* 中央(健康) + 右下(✎📍) */}
      {(() => {
        const showSleep = isIconVisible(summary, sortState, "sleep");
        const showStress = isIconVisible(summary, sortState, "stress");
        const showSkincare = isIconVisible(summary, sortState, "skincare");
        const showHealth = showSleep || showStress || showSkincare;

        const showPencil = Boolean(summary?.memo?.trim());
        const showPin = false; // TODO: 後で条件実装
        const showMeta = showPencil || showPin;

        if (!showHealth && !showMeta) return null;

        //アイコンサイズ（metasize）
        const healthSize = "h-3.5 w-3.5";
        const sleepSize = "h-4 w-4";
        const metaSize = "h-3 w-3";
        const metaColor = "text-[#596378]";

        const centerPos =
          "absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2";
        const metaPos = "absolute right-2 bottom-2 flex items-center gap-1";

        return (
          <>
            {/* ✅ 中央：健康があるときだけ */}
            {showHealth && (
              <div className={centerPos}>
                <div className="flex items-center justify-center gap-[2px]">
                  {showSleep && (
                    <SleepIcon
                      className={`block shrink-0 ${sleepSize} ${getHealthColor(
                        summary?.sleepQuality
                      )} -mr-[1px]`}
                    />
                  )}
                  {showStress && (
                    <StressIcon
                      className={`block shrink-0 ${healthSize} ${getHealthColor(
                        summary?.stressLevel
                      )}`}
                    />
                  )}
                  {showSkincare && (
                    <SkincareIcon
                      className={`block shrink-0 ${healthSize} ${getHealthColor(
                        summary?.skincareEffort
                      )}`}
                    />
                  )}
                </div>
              </div>
            )}

            {/* ✅ 右下固定：✎/📍 がある日は常に（1個でも右下） */}
            {showMeta && (
              <div className={metaPos}>
                {showPencil && (
                  <PiPencilFill
                    className={`block shrink-0 ${metaSize} ${metaColor}`} aria-hidden
                  />
                )}
                {showPin && (
                  <PinIcon
                    className={`block shrink-0 ${metaSize} ${metaColor} opacity-80`}
                  />
                )}
              </div>
            )}
          </>
        );
      })()}
    </button>
  );
}
