//components/records/RecordsScreen.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DailyRecordUpsertPayload } from "@/lib/types";
import { authFetch } from "@/lib/api";
import { formatYmdLocal } from "@/lib/date";
import RecordForm, { type RecordFormState, type PrefectureOption } from "./RecordForm";

type Props = {
  initialSelectedDate?: string;
  hideDatePicker?: boolean;
  cyclesFrom?: "calendar";
  onClose?: () => void;
  onSaved?: () => void;
};


/**
 * ✅ UI(form) → API(payload) 変換
 * （ここは正として使う）
 */
const toDailyRecordPayload = (
  selectedDate: string,
  form: RecordFormState
): DailyRecordUpsertPayload => {
  return {
    date: selectedDate,
    sleep: form.sleepQuality,
    stress: form.stressLevel,
    skin_condition: form.skinCondition,
    skincare_effort: form.skincareEffort,
    env_pref_code: form.prefectureCode,
    memo: form.memo?.trim() ? form.memo.trim() : null,
  };
};

/**
 * ✅ API(response) → UI(form) 変換
 * ※バックエンドのレスポンス形に合わせて調整する場所
 */
type DailyRecordResponse = {
  sleep?: number | null;
  stress?: number | null;
  skin_condition?: number | null;
  skincare_effort?: number | null;
  env_pref_code?: string | number | null;
  memo?: string | null;
};

const fromDailyRecordToForm = (
  data: DailyRecordResponse
): Partial<RecordFormState> => {
  return {
    sleepQuality: data.sleep ?? 3,
    stressLevel: data.stress ?? 3,
    skinCondition: data.skin_condition ?? 3,
    skincareEffort: data.skincare_effort ?? 3,
    prefectureCode: data.env_pref_code != null ? String(data.env_pref_code) : "13",
    memo: data.memo ?? "",
  };
};

type CycleLog = {
  start_date: string;
  end_date: string | null;
};

type UserProfile = {
  pref_code: string | number | null;
};

const isValidYmd = (ymd: string | null | undefined): ymd is string =>
  !!ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd);

const parseYmdToLocalDate = (ymd: string): Date => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export default function RecordsScreen({
  initialSelectedDate,
  hideDatePicker,
  cyclesFrom,
  onClose,
  onSaved,
}: Props) {
  const searchParams = useSearchParams();

  const today = useMemo(() => formatYmdLocal(new Date()), []);

  const [cycles, setCycles] = useState<CycleLog[]>([]);

  // 選択中の日付（初期値 = 今日 or クエリ）
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // ✅ モーダルから日付固定で渡された場合はそれを優先
    if (initialSelectedDate) return initialSelectedDate;
    const dataFromParams = searchParams.get("date");
    if (dataFromParams) return dataFromParams;

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`; // ローカルの "YYYY-MM-DD"
  });

  // フォームの中身
  const [form, setForm] = useState<RecordFormState>({
    sleepQuality: 3,
    stressLevel: 3,
    skinCondition: 3,
    skincareEffort: 3,
    prefectureCode: "13", // とりあえず東京都。後で jp_prefecture に合わせて変更
    memo: "",
  });

  // ✅ 追加：都道府県一覧
  const [prefectures, setPrefectures] = useState<PrefectureOption[]>([
    // APIが失敗しても画面が死なないように初期値を置いとく（温存保険）
    { pref_code: "13", name_ja: "東京都" },
    { pref_code: "27", name_ja: "大阪府" },
    { pref_code: "40", name_ja: "福岡県" },
  ]);
  const [profilePrefCode, setProfilePrefCode] = useState<string | null>(null);

  // この日付に既存レコードがあるかどうか
  const [hasRecord, setHasRecord] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const firstPrefCode = prefectures[0]?.pref_code;

  /**
   * ✅ 都道府県一覧を取得する（GET /prefectures）
   */
  const fetchPrefectures = async (): Promise<PrefectureOption[]> => {
    const res = await authFetch("/prefectures", {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`GET /prefectures failed: ${res.status}`);
    }

    const json = await res.json();
    // PrefectureListResponse: { prefectures: List[Prefecture], total: int }
    return json.prefectures as PrefectureOption[];
  };

  const fetchProfilePrefCode = async (): Promise<string | null> => {
    const res = await authFetch("/users/me", {
      method: "GET",
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 204) return null;
    if (!res.ok) throw new Error(`GET /users/me failed: ${res.status}`);
    const data: UserProfile = await res.json();
    return data.pref_code != null ? String(data.pref_code) : null;
  };

  /**
   * ✅ 日次記録取得（GET /records/{date}）
   */
  const fetchDailyRecord = useCallback(async (date: string) => {
    const res = await authFetch(`/records/${date}`, {
      method: "GET",
      cache: "no-store",
    });

    if (res.status === 404) return null; // レコードなし
    if (!res.ok) throw new Error(`GET /records/{date} failed: ${res.status}`);

    return await res.json();
  }, []);

  /**
   * ✅ 生理中かどうか（未終了cycleがあるか）を取得する（GET /cycles）
   * - CycleLogListResponse: { cycles: [...], total: number }
   */
  const fetchCycles = useCallback(async (): Promise<CycleLog[]> => {
    const res = await authFetch("/cycles?limit=50", {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      // 失敗しても画面は死なない（表示しないだけ）
      return [];
    }

    const json = await res.json();
    return (json?.cycles ?? []) as CycleLog[];
  }, []);

  /**
   * ✅ 日次記録Upsert
   */
  const upsertDailyRecord = async (
    date: string,
    payload: DailyRecordUpsertPayload,
    exists: boolean
  ) => {
    const url = exists ? `/records/${date}` : "/records";
    const method = exists ? "PATCH" : "POST";

    const res = await authFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`${method} ${url} failed: ${res.status}`);
    }

    return await res.json().catch(() => null);
  };

  /**
   * ✅ 削除（DELETE /records/{date}）
   */
  const deleteDailyRecord = async (date: string) => {
    const res = await authFetch(`/records/${date}`, {
      method: "DELETE",
    });
    if (!res.ok)
      throw new Error(`DELETE /records/{date} failed: ${res.status}`);
  };

  /**
   * ✅ 初回：都道府県一覧を取得 + 生理中フラグ取得
   */
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchPrefectures();
        if (Array.isArray(list) && list.length > 0) {
          setPrefectures(list);

          // form.prefectureCode が list に存在しない時の保険
          const exists = list.some((p) => p.pref_code === form.prefectureCode);
          if (!exists) {
            setForm((prev) => ({ ...prev, prefectureCode: list[0].pref_code }));
          }
        }
      } catch (e) {
        console.error(e);
        // 失敗しても初期値で動かす（温存保険）
      }

      try {
        const code = await fetchProfilePrefCode();
        if (code) {
          setProfilePrefCode(code);
        }
      } catch (e) {
        console.error(e);
      }

      try {
        const list = await fetchCycles();
        setCycles(list);
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🌱 クエリ(date=YYYY-MM-DD) が付いている場合だけ selectedDate を同期する
  // - ユーザーがフォーム上で日付を変更したときに「元に戻る」問題を防ぐため、selectedDate には依存しない
  useEffect(() => {
    // ✅ モーダル運用時はクエリ同期しない（固定日付のため）
    if (initialSelectedDate) return;
    const dataFromQuery = searchParams.get("date");
    if (!dataFromQuery) return;

    // クエリ側に未来が来た場合のガード
    if (dataFromQuery > today) {
      setError("未来の日付は選択できません");
      setSelectedDate(today);
      return;
    }

    // 同じ値なら set しない（無限ループ/チラつき防止）
    setSelectedDate((prev) => (prev === dataFromQuery ? prev : dataFromQuery));
  }, [searchParams, today, initialSelectedDate]);

  // 🌱 selectedDate が変わったら /records/{date} を叩いてフォーム初期化
  useEffect(() => {
    if (!selectedDate) return;

    (async () => {
      setIsLoading(true);
      setError(null);
      setMessage(null);

      try {
        const record = await fetchDailyRecord(selectedDate);

        if (!record) {
          setHasRecord(false);
          const defaultPref = profilePrefCode ?? firstPrefCode ?? "13";
          setForm((prev) => ({
            ...prev,
            sleepQuality: 3,
            stressLevel: 3,
            skinCondition: 3,
            skincareEffort: 3,
            prefectureCode: defaultPref,
            memo: "",
          }));
        } else {
          setHasRecord(true);
          setForm((prev) => ({
            ...prev,
            ...fromDailyRecordToForm(record),
          }));
        }
      } catch (e) {
        console.error(e);
        setError("記録の読み込みに失敗しました（認証が必要かも）");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedDate, fetchDailyRecord, profilePrefCode, firstPrefCode]);

  const isMenstruating = useMemo(() => {
    if (!isValidYmd(selectedDate) || cycles.length === 0) return false;
    const target = parseYmdToLocalDate(selectedDate);
    const todayDate = parseYmdToLocalDate(today);

    return cycles.some((c) => {
      if (!isValidYmd(c.start_date)) return false;
      const start = parseYmdToLocalDate(c.start_date);
      const end = isValidYmd(c.end_date)
        ? parseYmdToLocalDate(c.end_date)
        : todayDate;
      return target >= start && target <= end;
    });
  }, [cycles, selectedDate, today]);

  // 🌱 今日ボタン
  const handleSetToday = () => {
    setSelectedDate(today);
  };

  // 🌱 スライダー変更ハンドラ
  const handleChangeSlider =
    (field: keyof RecordFormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  // 🌱 都道府県変更
  const handleChangePrefecture = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, prefectureCode: e.target.value }));
  };

  // 🌱 メモ変更
  const handleChangeMemo = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, memo: e.target.value }));
  };

  // 🌱 登録（新規 or 更新）
  const handleSave = async () => {
    if (!selectedDate) return;

    // 念のためガード
    if (selectedDate > today) {
      setError("未来の日付は登録できません");
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    const payload = toDailyRecordPayload(selectedDate, form);

    try {
      await upsertDailyRecord(selectedDate, payload, hasRecord);
      setHasRecord(true);
      setMessage("記録を保存しました");
      // ✅ モーダルなら保存後に閉じる
      if (onSaved) onSaved();
    } catch (e) {
      console.error(e);
      setError("記録の保存に失敗しました（認証が必要かも）");
    } finally {
      setIsSaving(false);
    }
  };

  // 🌱 削除
  const handleDelete = async () => {
    if (!selectedDate || !hasRecord) return;

    if (!window.confirm("この日の記録を削除しますか？")) return;

    setIsDeleting(true);
    setError(null);
    setMessage(null);

    try {
      await deleteDailyRecord(selectedDate);

      setHasRecord(false);
      setForm((prev) => ({
        ...prev,
        sleepQuality: 3,
        stressLevel: 3,
        skinCondition: 3,
        skincareEffort: 3,
        memo: "",
      }));
      setMessage("記録を削除しました");
    } catch (e) {
      console.error(e);
      setError("記録の削除に失敗しました（認証が必要かも）");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <RecordForm
      selectedDate={selectedDate}
      today={today}
      form={form}
      hasRecord={hasRecord}
      isLoading={isLoading}
      isSaving={isSaving}
      isDeleting={isDeleting}
      error={error}
      message={message}
      isMenstruating={isMenstruating}
      prefectures={prefectures}
      hideDateCard={!!hideDatePicker}
      useInternalScroll={!!hideDatePicker}
      cyclesFrom={cyclesFrom}
      onCancel={onClose}
      onDateChange={(e) => {
        const v = e.target.value;
        if (v > today) {
          setError("未来の日付は選択できません");
          return;
        }
        setSelectedDate(v);
      }}
      onSetToday={handleSetToday}
      onChangeSlider={handleChangeSlider}
      onChangePrefecture={handleChangePrefecture}
      onChangeMemo={handleChangeMemo}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}
