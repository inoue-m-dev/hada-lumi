// frontend/src/components/records/GradientSliderRow.tsx
"use client";

import React from "react";

type Props = {
  label: string;
  value: number; // 1-5
  onChange: (v: number) => void;

  // 互換のため残す（呼び出し側が渡してても無視してOK）
  gradientFrom?: string;
  gradientTo?: string;
  thumbBorder: string;

  icon?: React.ReactNode;
  toneColor?: string;
  thin?: boolean;

  leftLabel?: string;
  rightLabel?: string;
};

export function GradientSliderRow({
  label,
  value,
  onChange,
  thumbBorder,
  icon,
  toneColor,
  thin = true,
  leftLabel = "悪い",
  rightLabel = "良い",
}: Props) {
  const v = Math.min(5, Math.max(1, Number(value) || 3));

  const trackH = thin ? "h-[6px]" : "h-2";
  const thumbSize = thin ? 18 : 22;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-xs font-medium text-[#596377]">
            {label}
            <span className="ml-1 tabular-nums text-base font-semibold text-[#596377]">
              : {v}
            </span>
          </p>
        </div>
      </div>

      <div className="relative">
        {/* track：単色 */}
        <div
          className={`w-full rounded-full ${trackH}`}
          style={{
            backgroundColor: "#B4B7C0",
            opacity: 0.35,
          }}
        />

        {/* input */}
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={v}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          aria-label={label}
        />

        {/* thumb（●） */}
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full border"
          style={{
            width: thumbSize,
            height: thumbSize,
            borderColor: thumbBorder,
            backgroundColor: toneColor ?? "#B4B7C0",
            left: `calc(${((v - 1) / 4) * 100}% - ${thumbSize / 2}px)`,
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          }}
        />
      </div>

      <div className="flex justify-between text-[13px] font-medium text-[#B4B7C0]">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
