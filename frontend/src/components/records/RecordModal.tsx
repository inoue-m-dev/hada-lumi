// frontend/src/components/records/RecordModal.tsx
"use client";

import { useMemo } from "react";
import { formatYmdLocal } from "@/lib/date";
import RecordsScreen from "./RecordsScreen";

type DailySummary = {
  sleepQuality?: number | null;
  stressLevel?: number | null;
  skincareEffort?: number | null;
  skinCondition?: number | null;
};

type Props = {
  date: Date;
  initialSummary?: DailySummary; // 今回は未使用（最短で動かすため）
  onClose: () => void;
  onSaved: () => void;
};

export default function RecordModal({ date, onClose, onSaved }: Props) {
  const ymd = useMemo(() => formatYmdLocal(date), [date]);

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
        aria-label="close"
      />

      {/* panel */}
      <div className="absolute left-1/2 top-1/2 h-[92vh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-lg">
        {/* ヘッダー（モーダル用） */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-medium">{ymd} の記録</div>
          <button type="button" onClick={onClose} className="text-sm opacity-70">
            閉じる
          </button>
        </div>

        {/* 中身：RecordFormそっくり（=RecordFormそのもの） */}
        <div className="h-[calc(92vh-49px)]">
          <RecordsScreen
            initialSelectedDate={ymd}
            hideDatePicker
            cyclesFrom="calendar"
            onSaved={onSaved}
          />
        </div>
      </div>
    </div>
  );
}
