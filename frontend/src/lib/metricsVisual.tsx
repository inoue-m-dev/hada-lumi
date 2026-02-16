// frontend/src/lib/metricsVisual.tsx
import { Moon, Sparkles } from "lucide-react";

type IconProps = {
  className?: string;
  size?: number;
  strokeWidth?: number;
};

/**
 * 生理（Moon）
 */
export function MenstruationIcon({
  className,
  size = 14,
  strokeWidth = 1.25,
}: IconProps) {
  return <Moon className={className} size={size} strokeWidth={strokeWidth} />;
}

/**
 * 肌良好（Sparkles）
 */
export function GoodSkinIcon({
  className,
  size = 14,
  strokeWidth = 1.25,
}: IconProps) {
  return (
    <Sparkles className={className} size={size} strokeWidth={strokeWidth} />
  );
}

/**
 * 肌不調（旗：中を currentColor で塗る）
 * - className の text-**** / text-[#xxxxxx] で色が変わる
 * - 選択時に白にしたいなら CalendarPage 側で className を切り替えるだけ
 */
export function BadSkinIcon({
  className,
  size = 14,
  strokeWidth = 1.25,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* ポール（線） */}
      <path
        d="M6 22V2.8a.8.8 0 0 1 1.17-.71"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 旗（塗り） */}
      <path
        d="M7.2 2.4L18.6 8.1a.8.8 0 0 1 0 1.4L7.2 15.2Z"
        fill="currentColor"
      />
    </svg>
  );
}


export type MetricKey = "sleepQuality" | "stressLevel" | "skincareEffort";

type BadgeTone = "good" | "bad";

export type CalendarBadge = {
  key: MetricKey;
  tone: BadgeTone;
  color: string;
  aria: string;
};

// ✅ バッジ色（濃い=bad / 薄い=good）
const BADGE_COLORS: Record<MetricKey, { bad: string; good: string; aria: string }> = {
  sleepQuality: { bad: "#243B6D", good: "#AFC0E1", aria: "睡眠" },
  stressLevel: { bad: "#B07A00", good: "#F2E7B9", aria: "ストレス" },
  skincareEffort: { bad: "#4C2B7A", good: "#C7B3E5", aria: "スキンケア" },
};

/**
 * カレンダーの「原因バッジ」を上下レイヤーに分解して返す
 * - <=2 : bad（下段・濃い）
 * - >=4 : good（上段・薄い）
 * - 3   : 出さない
 */
export function getCalendarBadges(summary: {
  sleepQuality?: number;
  stressLevel?: number;
  skincareEffort?: number;
}): { top: CalendarBadge[]; bottom: CalendarBadge[] } {
  const top: CalendarBadge[] = [];
  const bottom: CalendarBadge[] = [];

  (Object.keys(BADGE_COLORS) as MetricKey[]).forEach((k) => {
    const v = summary[k];
    if (typeof v !== "number") return;

    if (v <= 2) {
      bottom.push({
        key: k,
        tone: "bad",
        color: BADGE_COLORS[k].bad,
        aria: BADGE_COLORS[k].aria,
      });
    } else if (v >= 4) {
      top.push({
        key: k,
        tone: "good",
        color: BADGE_COLORS[k].good,
        aria: BADGE_COLORS[k].aria,
      });
    }
  });

  return { top, bottom };
}

//バッジカレンダー下表示用
export function getMetricDotColor(
  metric: MetricKey,
  value: number
): string | null {
  if (typeof value !== "number") return null;

  // ✅ 3は出さない（カレンダールールと同じ）
  if (value === 3) return null;

  const palette = BADGE_COLORS[metric];
  if (!palette) return null;

  // <=2 は濃い / >=4 は薄い
  if (value <= 2) return palette.bad;
  if (value >= 4) return palette.good;

  return null;
}

//アイコンバッジカレンダー下表示用
export type SkinTone = "bad" | "good" | null;

export function getSkinTone(skinCondition?: number): SkinTone {
  if (typeof skinCondition !== "number") return null;
  if (skinCondition <= 2) return "bad";
  if (skinCondition >= 4) return "good";
  return null; // 3は出さない
}
