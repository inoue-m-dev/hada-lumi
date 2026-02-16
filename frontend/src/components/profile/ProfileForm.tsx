// components/profile/ProfileForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/api";
import * as Select from "@radix-ui/react-select";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const SKIN_TYPES = [
  { value: "dry", label: "乾燥肌" },
  { value: "oily", label: "脂性肌" },
  { value: "normal", label: "普通肌" },
  { value: "combination", label: "混合肌" },
  { value: "sensitive", label: "敏感肌" },
];

const CYCLE_DAYS = Array.from({ length: 21 }, (_, i) => 20 + i); // 20〜40

type UserResponse = {
  skin_type: string | null;
  cycle_length_days: number | null;
  last_menstruation_start: string | null; // "YYYY-MM-DD"
  pref_code: string | null;
  pref_name: string | null;
};

const normalizePrefCode = (value: string | number | null | undefined): string => {
  if (value == null) return "";
  return String(value).trim().padStart(2, "0");
};

export default function ProfileForm() {
  const router = useRouter();

  const [prefList, setPrefList] = useState<
    { pref_code: string; name_ja: string }[]
  >([]);
  // フォーム用 state
  const [prefCode, setPrefCode] = useState("");
  const [prefNameFromProfile, setPrefNameFromProfile] = useState("");
  const [skinType, setSkinType] = useState("");
  const [cycleLength, setCycleLength] = useState<string>("");
  const [lastStartDate, setLastStartDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    prefCode?: string;
    skinType?: string;
    cycleLength?: string;
    lastStartDate?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  // 通信状態
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCycles, setHasCycles] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [prefRes, profileRes] = await Promise.all([
          fetch(`${API_BASE_URL}/prefectures`, {
            method: "GET",
            cache: "no-store",
          }),
          authFetch("/users/me", { method: "GET" }),
        ]);

        if (!prefRes.ok) throw new Error("Failed to fetch prefectures");

        const prefData = await prefRes.json();
        const prefListRaw = Array.isArray(prefData.prefectures)
          ? prefData.prefectures
          : [];
        const normalized: { pref_code: string; name_ja: string }[] = prefListRaw.map(
          (pref: { pref_code: string | number; name_ja: string }) => ({
            pref_code: normalizePrefCode(pref.pref_code),
            name_ja: pref.name_ja,
          }),
        );
        setPrefList(normalized);

        if (profileRes.status === 404 || profileRes.status === 204) {
          return;
        }
        if (!profileRes.ok) {
          throw new Error(`Failed to fetch profile: ${profileRes.status}`);
        }

        const profile: UserResponse = await profileRes.json();
        const fetchedPrefCode = normalizePrefCode(profile.pref_code);
        setPrefCode(fetchedPrefCode);
        setPrefNameFromProfile(profile.pref_name ?? "");
        setSkinType(profile.skin_type ?? "");
        setCycleLength(
          profile.cycle_length_days != null
            ? String(profile.cycle_length_days)
            : "",
        );
        setLastStartDate(profile.last_menstruation_start ?? "");
      } catch (err) {
        console.error(err);
        setError("プロフィール情報の取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchHasCycles = async () => {
      try {
        const res = await authFetch("/cycles?limit=1", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        const cycles = Array.isArray(data?.cycles) ? data.cycles : [];
        setHasCycles(cycles.length > 0);
      } catch (err) {
        console.error(err);
      }
    };

    fetchHasCycles();
  }, []);

  // pref_code から都道府県名を引くヘルパー
  const resolvePrefName = (code: string | null | undefined): string | null => {
    if (!code) return null;
    const normalizedCode = normalizePrefCode(code);
    const hit = prefList.find((p) => normalizePrefCode(p.pref_code) === normalizedCode);
    return hit ? hit.name_ja : null;
  };

  // 初回マウント時に /prefectures と /users/me をまとめて取得

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errors: typeof fieldErrors = {};

    if (!prefCode) errors.prefCode = "居住地を選択してください";
    if (!skinType) errors.skinType = "肌タイプを選択してください";
    if (cycleLength === "") errors.cycleLength = "生理周期を選択してください";
    if (!lastStartDate && !hasCycles)
      errors.lastStartDate = "直近の生理開始日を選択してください";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("未入力の項目があります。");
      return;
    }

    setIsSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const prefName = resolvePrefName(prefCode);

      // 設計書どおり PATCH /users/me の Body を組み立て
      const body = {
        skin_type: skinType || undefined,
        cycle_length_days:
          cycleLength === "" ? undefined : Number(cycleLength),
        last_menstruation_start: lastStartDate || undefined,
        pref_code: prefCode || undefined,
        pref_name: prefName || undefined,
        // is_menstruation_user は今回UIにないので送らない
      };

      const res = await authFetch("/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Failed to update profile: ${res.status}`);
      }

      alert("プロフィール情報を保存しました。");
      window.dispatchEvent(new Event("profile-updated"));
      // 必要ならホームに戻すなど
      // router.push("/");
    } catch (e) {
      console.error(e);
      setError("プロフィール情報の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedPrefLabel =
    resolvePrefName(prefCode) || prefNameFromProfile || "選択してください";

  return (
    <main className="min-h-screen bg-[#FDFCFC] px-6 pt-4 pb-10">
      {/* ヘッダー */}
      <header className="mb-6 flex items-center">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-[#FFE3E5]"
          aria-label="戻る"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            className="text-[#596377]"
          >
            <path
              d="M15 5 9 12l6 7"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="flex-1 text-center text-base font-semibold tracking-wide text-[#574143]">
          プロフィール登録
        </h1>
        <div className="w-9" />
      </header>

      <form onSubmit={handleSubmit} className="space-y-5 text-[15px] text-[#596377]">
        {isLoading && (
          <p className="text-xs text-[#B4B7C0]">プロフィールを読み込み中…</p>
        )}
        {formError && <p className="text-xs text-red-500">{formError}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* 居住地 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#574143]">居住地</label>
          <div
            className={`relative rounded-2xl px-4 py-3 ${
              fieldErrors.prefCode
                ? "bg-[#FFE3E5] ring-1 ring-red-400"
                : "bg-[#FDFCFC] border border-[#E6E7EB]"
            } shadow-sm`}
          >
            <Select.Root
             value={prefCode}
              onValueChange={(v) => setPrefCode(v)}
              disabled={isLoading || isSaving}
            >
              <Select.Trigger
                className="flex w-full items-center justify-between bg-transparent text-base outline-none"
                aria-label="居住地"
              >
                <span className="text-[#596377]">
                  {selectedPrefLabel}
                </span>
                <Select.Icon className="ml-2 text-[#B4B7C0]">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      d="M8 10l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  position="popper"
                  sideOffset={8}
                  className="z-50 max-h-[50vh] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-[#E6E7EB] bg-[#FDFCFC] shadow-lg"
                >
                  <Select.Viewport className="p-1">
                    {prefList.map((pref) => (
                      <Select.Item
                        key={pref.pref_code}
                        value={pref.pref_code}
                        className="cursor-pointer select-none rounded-xl px-3 py-2.5 text-base text-[#596377] outline-none focus:bg-[#FFE3E5] data-[state=checked]:bg-[#FFF1F3]"
                      >
                        <Select.ItemText>{pref.name_ja}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
           </Select.Root>
           
          </div>
          {fieldErrors.prefCode && (
            <p className="text-xs text-red-500">{fieldErrors.prefCode}</p>
          )}
        </div>

        {/* 肌タイプ */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#574143]">肌タイプ</label>
          <div
            className={`relative rounded-2xl px-4 py-3 ${
              fieldErrors.skinType
                ? "bg-[#FFE3E5] ring-1 ring-red-400"
                : "bg-[#FDFCFC] border border-[#E6E7EB]"
            } shadow-sm`}
          >
            <Select.Root
              value={skinType}
              onValueChange={(v) => setSkinType(v)}
              disabled={isLoading || isSaving}
            >
              <Select.Trigger
                className="flex w-full items-center justify-between bg-transparent text-base text-[#596377] outline-none"
                aria-label="肌タイプ"
              >
                <Select.Value
                  placeholder="選択してください"
                  className="text-[#596377]"
                />
                <Select.Icon className="ml-2 text-[#B4B7C0]">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      d="M8 10l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  position="popper"
                  sideOffset={8}
                  className="z-50 max-h-[50vh] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-[#E6E7EB] bg-[#FDFCFC] shadow-lg"
                >
                  <Select.Viewport className="p-1">
                    {SKIN_TYPES.map((type) => (
                      <Select.Item
                        key={type.value}
                        value={type.value}
                        className="cursor-pointer select-none rounded-xl px-3 py-2.5 text-base text-[#596377] outline-none focus:bg-[#FFE3E5] data-[state=checked]:bg-[#FFF1F3]"
                      >
                        <Select.ItemText>{type.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
          {fieldErrors.skinType && (
            <p className="text-xs text-red-500">{fieldErrors.skinType}</p>
          )}
        </div>

        {/* 生理周期 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#574143]">生理周期</label>
          <div
            className={`relative rounded-2xl px-4 py-3 ${
              fieldErrors.cycleLength
                ? "bg-[#FFE3E5] ring-1 ring-red-400"
                : "bg-[#FDFCFC] border border-[#E6E7EB]"
            } shadow-sm`}
          >
            <Select.Root
              value={cycleLength}
              onValueChange={(v) => setCycleLength(v)}
              disabled={isLoading || isSaving}
            >
              <Select.Trigger
                className="flex w-full items-center justify-between bg-transparent text-base text-[#596377] outline-none"
                aria-label="生理周期"
              >
                <Select.Value
                  placeholder="選択してください"
                  className="text-[#596377]"
                />
                <Select.Icon className="ml-2 text-[#B4B7C0]">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      d="M8 10l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  position="popper"
                  sideOffset={8}
                  className="z-50 max-h-[50vh] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-[#E6E7EB] bg-[#FDFCFC] shadow-lg"
                >
                  <Select.Viewport className="p-1">
                    {CYCLE_DAYS.map((day) => (
                      <Select.Item
                        key={day}
                        value={String(day)}
                        className="cursor-pointer select-none rounded-xl px-3 py-2.5 text-base text-[#596377] outline-none focus:bg-[#FFE3E5] data-[state=checked]:bg-[#FFF1F3]"
                      >
                        <Select.ItemText>{day}日</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
          {fieldErrors.cycleLength && (
            <p className="text-xs text-red-500">{fieldErrors.cycleLength}</p>
          )}
        </div>

        {/* 直近の生理開始日 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#574143]">
            直近の生理開始日
          </label>
          <div
            className={`rounded-2xl px-4 py-3 ${
              fieldErrors.lastStartDate
                ? "bg-[#FFE3E5] ring-1 ring-red-400"
                : "bg-[#FDFCFC] border border-[#E6E7EB]"
            } shadow-sm`}
          >
            <input
              type="date"
              className="w-full bg-transparent text-[15px] leading-6 outline-none appearance-none text-[#596377]"
              value={lastStartDate}
              onChange={(e) => setLastStartDate(e.target.value)}
              disabled={isLoading || isSaving || hasCycles}
            />
          </div>
          {hasCycles && (
            <p className="text-xs text-[#B4B7C0]">
              生理ログがあるため、この項目は生理ログから更新してください
            </p>
          )}
          {fieldErrors.lastStartDate && (
            <p className="text-xs text-red-500">
              {fieldErrors.lastStartDate}
            </p>
          )}
        </div>

        {/* 登録ボタン */}
        <div className="pt-4">
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-full bg-[#EBCFD1] text-sm font-semibold tracking-wide text-[#596377] shadow-sm hover:bg-[#D7A7AB] active:bg-[#CE9A9F] disabled:opacity-60"
            disabled={isLoading || isSaving}
          >
            {isSaving ? "保存中..." : "登録"}
          </button>
        </div>
      </form>
    </main>
  );
}
