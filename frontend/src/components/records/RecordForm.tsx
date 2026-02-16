// frontend/src/components/records/RecordForm.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { GradientSliderRow } from "./GradientSliderRow";
import { MenstruationIcon } from "@/lib/metricsVisual";

export type RecordFormState = {
  sleepQuality: number;
  stressLevel: number;
  skinCondition: number;
  skincareEffort: number;
  prefectureCode: string;
  memo: string;
};

export type PrefectureOption = { pref_code: string; name_ja: string };

type Props = {
  selectedDate: string;
  today: string;
  form: RecordFormState;
  hasRecord: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  error: string | null;
  message: string | null;

  isMenstruating: boolean;
  prefectures: PrefectureOption[];

  // ✅ modal用
  hideDateCard?: boolean;
  cyclesFrom?: "calendar";
  useInternalScroll?: boolean;
  onCancel?: () => void;

  onDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSetToday: () => void;
  onChangeSlider: (
    field: keyof RecordFormState
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChangePrefecture: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onChangeMemo: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSave: () => void;
  onDelete: () => void;
};

// 🎨 指定パレット
const UI = {
  title: "#574143",
  bg: "#FDFCFC",
  border: "#E6E7EB",
  text: "#596377",
  sub: "#B4B7C0",
  bad: "#EBCFD1",
  neutral: "#FFE3E5",
  good: "#FFF1F3",
  calendargood:"#fa98e9",
  calendarbad:"#962a83"
};

// 肌状態 チップ内文字
function skinNumberColor(tone: SkinTone) {
  if (tone === "good") return "#c2c6d1"; 
  return "#FFFFFF";
}

//  コンディション アイコン色ロジック
function toneColor(score: number) {
  const v = Number(score) || 3;
  if (v <= 2) return UI.calendarbad;
  if (v >= 4) return UI.calendargood;
  return UI.sub;
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border shadow-sm"
      style={{ backgroundColor: UI.bg, borderColor: UI.border }}
    >
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p
          className="text-sm font-semibold tracking-wide"
          style={{ color: UI.title }}
        >
          {title}
        </p>
        {right}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

// 💤 Lucide風だけど「塗りZzz（RiZzzFill寄せ）」
// - color: 塗り色
// - size: 表示サイズ
function SleepZzzIcon({
  color,
  size = 18,
}: {
  color: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {/* 大きいZ */}
      <path
        d="M4.2 14.4c0-.55.45-1 1-1h7.6c.42 0 .8.26.94.66.14.4.04.84-.26 1.14L8.35 20h4.45c.55 0 1 .45 1 1s-.45 1-1 1H5.2c-.42 0-.8-.26-.94-.66-.14-.4-.04-.84.26-1.14L9.65 15.4H5.2c-.55 0-1-.45-1-1Z"
        fill={color}
      />

      {/* 小さいZ */}
      <path
        d="M12.4 6.2c0-.5.4-.9.9-.9h6.1c.38 0 .72.24.84.6.13.36.04.76-.23 1.03l-3.88 3.87h3.57c.5 0 .9.4.9.9s-.4.9-.9.9h-6.1c-.38 0-.72-.24-.84-.6-.13-.36-.04-.76.23-1.03l3.88-3.87H13.3c-.5 0-.9-.4-.9-.9Z"
        fill={color}
        opacity="0.95"
      />
    </svg>
  );
}


function StressIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
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

function SkincareIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
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

type SkinTone = "bad" | "neutral" | "good";

function skinTone(score: number): SkinTone {
  const v = Number(score) || 3;
  if (v <= 2) return "bad";
  if (v >= 4) return "good";
  return "neutral";
}

function skinToneBg(tone: SkinTone) {
  if (tone === "bad") return UI.bad; // #EBCFD1
  if (tone === "good") return UI.good; // #FFF1F3
  return UI.neutral; // #FFE3E5
}

function SkinConditionPicker({
  value,
  onPick,
}: {
  value: number;
  onPick: (v: number) => void;
}) {
  const selected = Math.min(5, Math.max(1, Number(value) || 3));

  const [flash, setFlash] = useState<number | null>(null);

  return (
    <section
      className="rounded-2xl border shadow-sm"
      style={{ backgroundColor: UI.bg, borderColor: UI.border }}
    >
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p
          className="text-sm font-semibold tracking-wide"
          style={{ color: UI.title }}
        >
          肌状態
        </p>
      </div>

      <div className="px-4 pb-4">
        {/* 肌状態：3　表示
        <p className="text-sm font-semibold mb-1" style={{ color: UI.text }}>
          肌状態：{selected}
        </p> */}

        {/* ネイルチップ風：中央に横並び */}
        <div className="flex justify-center">
          <div className="grid grid-cols-5 gap-3 place-items-center">
            {[1, 2, 3, 4, 5].map((n) => {
              const tone = skinTone(n);
              const isActive = selected === n;

              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    onPick(n);
                    setFlash(n);
                    window.setTimeout(
                      () => setFlash((cur) => (cur === n ? null : cur)),
                      900
                    );
                  }}
                  aria-label={`肌状態 ${n}`}
                  className={[
                    "relative w-10 h-16 rounded-2xl border transition",
                    "overflow-hidden select-none",
                    "focus:outline-none focus-visible:ring-2",
                    "motion-reduce:transition-none",
                    isActive ? "shadow-sm ring-2 ring-[#C9CED6]" : "",
                  ].join(" ")}
                  style={{
                    backgroundColor: skinToneBg(tone),
                    // ✅ チップ選択枠
                    borderColor: UI.border,
                  }}
                >
                  {/* ✨ キラ  */}
                  {(isActive || flash === n) && (
                    <span
                      className={[
                        "pointer-events-none absolute inset-0",
                        // 艶ハイライト（5は少し強め）
                        "before:content-[''] before:absolute before:left-0 before:right-0 before:top-0",
                        n === 5
                          ? "before:h-5 before:bg-gradient-to-b before:from-white/50 before:to-transparent"
                          : "before:h-4 before:bg-gradient-to-b before:from-white/35 before:to-transparent",

                        // 斜めシマー1本目
                        "after:content-[''] after:absolute after:top-0 after:bottom-0 after:w-[140%]",
                        "after:-left-[160%] after:skew-x-[-20deg]",
                        n === 5
                          ? "after:bg-gradient-to-r after:from-transparent after:via-white after:to-transparent after:opacity-100"
                          : "after:bg-gradient-to-r after:from-transparent after:via-white/80 after:to-transparent after:opacity-95",
                        n === 5
                          ? "after:animate-[skinShimmer_850ms_ease-out_1]"
                          : "after:animate-[skinShimmer_700ms_ease-out_1]",
                        "",
                        "motion-reduce:after:animate-none",
                      ].join(" ")}
                    >
                      {/* ✅ 5だけ、もう1本キラ筋を重ねる */}
                      {n === 5 && (
                        <span
                          className={[
                            "absolute top-0 bottom-0 w-[140%]",
                            "-left-[170%] skew-x-[-20deg]",
                            "bg-gradient-to-r from-transparent via-white/80 to-transparent",
                            "opacity-95",
                            "animate-[skinShimmer2_1050ms_ease-out_1]",
                            "motion-reduce:animate-none",
                          ].join(" ")}
                        />
                      )}
                      {n === 5 && flash === 5 && (
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={{
                            // 小さな星粒を複製（画像っぽい“散り”）
                            boxShadow: `
                            8px 10px 0 0 rgba(255,255,255,0.9),
                            22px 18px 0 0 rgba(255,255,255,0.75),
                            30px 8px 0 0 rgba(255,255,255,0.65),
                            12px 30px 0 0 rgba(255,255,255,0.7),
                            28px 28px 0 0 rgba(255,255,255,0.8)
                          `,
                            width: "2px",
                            height: "2px",
                            borderRadius: "999px",
                            position: "absolute",
                            left: "6px",
                            top: "10px",
                            animation: "sparkPop 900ms ease-out 1",
                            animationFillMode: "both",
                          }}
                        />
                      )}
                    </span>
                  )}
                  {/*チップ内数字 */}
                  {flash === n && (
                    <span
                      className={[
                        "pointer-events-none absolute inset-0 flex items-center justify-center",
                        "text-sm font-semibold",
                        "animate-[popFade_900ms_ease-out_1]",
                      ].join(" ")}
                      style={{ color: skinNumberColor(tone) }}
                    >
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ✅ ゆらぎ / 安定：grid の外に置く */}
        <div className="mt-1 flex justify-center">
          {/* チップ5本と同じ“島幅” */}
          <div
            className="flex justify-between text-[11px]"
            style={{ color: UI.sub, width: "calc(5 * 2.5rem + 4 * 0.75rem)" }}
          >
            <span>ゆらぎ</span>
            <span>安定</span>
          </div>
        </div>

        {/* keyframes */}
        <style jsx>{`
          @keyframes skinShimmer {
            0% {
              transform: translateX(-140%) skewX(-20deg);
              opacity: 0;
            }
            12% {
              opacity: 1;
            }
            100% {
              transform: translateX(140%) skewX(-20deg);
              opacity: 0;
            }
          }
          @keyframes popFade {
            0% {
              opacity: 0;
              transform: scale(0.92);
              filter: blur(1px);
            }
            18% {
              opacity: 1;
              transform: scale(1);
              filter: blur(0px);
            }
            70% {
              opacity: 0.25;
              transform: scale(1.02);
            }
            100% {
              opacity: 0;
              transform: scale(1.04);
            }
          }

          @keyframes skinShimmer2 {
            0% {
              transform: translateX(-170%) skewX(-20deg);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            100% {
              transform: translateX(150%) skewX(-20deg);
              opacity: 0;
            }
          }
            @keyframes sparkPop {
  0% { transform: scale(0.8); opacity: 0; filter: blur(1px); }
  18% { opacity: 1; filter: blur(0px); }
  100% { transform: scale(1.15); opacity: 0; }
}

        `}</style>
      </div>
    </section>
  );
}


export default function RecordForm({
  selectedDate,
  today,
  form,
  hasRecord,
  isLoading,
  isSaving,
  isDeleting,
  error,
  message,
  isMenstruating,
  prefectures,
  hideDateCard,
  onCancel,
  onDateChange,
  onSetToday,
  onChangeSlider,
  onChangePrefecture,
  onChangeMemo,
  onSave,
  onDelete,
  cyclesFrom,
  useInternalScroll = false,
}: Props) {
  const sleepC = toneColor(form.sleepQuality);
  const stressC = toneColor(form.stressLevel);
  const skincareC = toneColor(form.skincareEffort);

  const containerClass = useInternalScroll
    ? "h-full flex flex-col"
    : "flex flex-col";
  const mainClass = useInternalScroll
    ? "flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-3"
    : "px-4 pt-4 pb-6 space-y-3";

  return (
    <div className={containerClass} style={{ backgroundColor: UI.bg }}>
      <main className={mainClass}>
        {(error || message) && (
          <div className="text-xs">
            {error && <p className="text-red-500">{error}</p>}
            {message && !error && <p style={{ color: UI.sub }}>{message}</p>}
          </div>
        )}
        {!hideDateCard && (
          <Card title="日付">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={onDateChange}
                className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm"
                style={{ borderColor: UI.border, color: UI.text }}
              />
              <button
                type="button"
                onClick={onSetToday}
                className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
                style={{ borderColor: UI.border, color: UI.text }}
              >
                今日
              </button>
            </div>

            {isLoading && (
              <p className="mt-2 text-[11px]" style={{ color: UI.sub }}>
                記録を読み込み中...
              </p>
            )}
          </Card>
        )}

        {/* 肌状態（最上段・ボタン選択式） */}
        <SkinConditionPicker
          value={form.skinCondition}
          onPick={(v) =>
            onChangeSlider("skinCondition")({
              target: { value: String(v) },
            } as React.ChangeEvent<HTMLInputElement>)
          }
        />

        {/* コンディション */}
         <Card title="コンディション">
         <div className="space-y-5">
            <GradientSliderRow
              label="睡眠の質"
              value={form.sleepQuality}
              onChange={(v) =>
                onChangeSlider("sleepQuality")({
                  target: { value: String(v) },
                } as React.ChangeEvent<HTMLInputElement>)
              }
              thumbBorder={UI.border}
              thin
              toneColor={sleepC}
              icon={<SleepZzzIcon color={sleepC} size={20} />}
              leftLabel="悪い"
              rightLabel="良い"
            />

            <GradientSliderRow
              label="ストレス"
              value={form.stressLevel}
              onChange={(v) =>
                onChangeSlider("stressLevel")({
                  target: { value: String(v) },
                } as React.ChangeEvent<HTMLInputElement>)
              }
              thumbBorder={UI.border}
              thin
              toneColor={stressC}
              icon={<StressIcon color={stressC} size={20} />}
              leftLabel="しんどい"
              rightLabel="余裕"
            />

            <GradientSliderRow
              label="スキンケア頑張り度"
              value={form.skincareEffort}
              onChange={(v) =>
                onChangeSlider("skincareEffort")({
                  target: { value: String(v) },
                } as React.ChangeEvent<HTMLInputElement>)
              }
              thumbBorder={UI.border}
              thin
              toneColor={skincareC}
              icon={<SkincareIcon color={skincareC} size={20} />}
              leftLabel="サボった"
              rightLabel="頑張った"
            />
          </div>
        </Card>

        {/* 生理（UIのみ） */}
        <Card
          title="生理"
          right={
            isMenstruating ? (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: UI.text }}
              >
                <MenstruationIcon
                  size={18}
                  strokeWidth={1.6}
                  className="text-[#596378]"
                  aria-hidden="true"
                />
                生理中
              </span>
            ) : (
              <span className="text-[11px]" style={{ color: UI.sub }}>
                ※開始/終了を記録
              </span>
            )
          }
        >
          {(() => {
            const params = new URLSearchParams({ date: selectedDate });
            if (cyclesFrom) params.set("from", cyclesFrom);
            return (
              <Link
                href={`/cycles?${params.toString()}`}
                className="block w-full text-center px-3 py-2 rounded-xl border text-xs font-semibold"
                style={{
                  borderColor: UI.border,
                  color: UI.text,
                  backgroundColor: UI.good,
                }}
              >
                生理ログを開く
              </Link>
            );
          })()}
        </Card>

        {/* 場所（表示は日付横に出してるけど、編集はここでできる） */}
        <Card title="場所">
          <select
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
            style={{ borderColor: UI.border, color: UI.text }}
            value={form.prefectureCode}
            onChange={onChangePrefecture}
          >
            {prefectures.map((p) => (
              <option key={p.pref_code} value={p.pref_code}>
                {p.name_ja}
              </option>
            ))}
          </select>
        </Card>

        {/* メモ（255表記なし） */}
        <Card title="メモ">
          <textarea
            rows={3}
            className="w-full rounded-xl border bg-white px-3 py-2 text-sm resize-none"
            style={{ borderColor: UI.border, color: UI.text }}
            placeholder="今日の気づきを入力..."
            value={form.memo}
            onChange={onChangeMemo}
          />
        </Card>
      </main>

      {/* sticky footer */}
      <footer
        className="sticky bottom-0 px-4 py-3 border-t backdrop-blur-sm"
        style={{ borderColor: UI.border, backgroundColor: `${UI.bg}F2` }}
      >
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving || isDeleting}
              className="flex-1 py-2.5 rounded-full border text-xs font-semibold"
              style={{
                borderColor: UI.border,
                color: UI.text,
                backgroundColor: UI.bg,
                opacity: isSaving || isDeleting ? 0.6 : 1,
              }}
            >
              キャンセル
            </button>
          )}
          <button
            type="button"
            disabled={!hasRecord || isDeleting}
            onClick={onDelete}
            className="flex-1 py-2.5 rounded-full border text-xs font-semibold"
            style={{
              borderColor: UI.border,
              color: !hasRecord || isDeleting ? UI.sub : UI.text,
              backgroundColor: UI.bg,
              opacity: !hasRecord || isDeleting ? 0.6 : 1,
            }}
          >
            {isDeleting ? "削除中..." : "削除"}
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="flex-1 py-2.5 rounded-full text-xs font-semibold"
            style={{
              backgroundColor: UI.bad, // ✅ AI分析ボタン寄せ（仮：#EBCFD1）
              color: UI.text,
              opacity: isSaving ? 0.6 : 1,
              border: `1px solid ${UI.border}`,
            }}
          >
            {isSaving ? "保存中..." : hasRecord ? "変更を保存する" : "登録"}
          </button>
        </div>
      </footer>
    </div>
  );
}
