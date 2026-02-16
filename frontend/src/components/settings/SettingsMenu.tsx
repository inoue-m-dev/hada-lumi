// components/settings/SettingsMenu.tsx
"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

// Heroicons（プロフィールだけ）
import { UserIcon } from "@heroicons/react/24/outline";

// Lucide（それ以外）
import { KeyRound, Bell, ShieldCheck, Info, LogOut } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase";

const IconBox = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFE3E5]">
    {children}
  </div>
);

export default function SettingsMenu() {
  const router = useRouter();

  const handleGoProfile = () => {
    router.push("/profile");
  };

  const handleLogout = async () => {
    try {
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error("Firebase が初期化されていません。");
      }
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error("Failed to sign out:", error);
      alert("ログアウトに失敗しました。少し時間をおいて再度お試しください。");
    }
  };

  // メニュー行の共通スタイル
  const rowClass =
    "flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left transition active:opacity-70";

  return (
    <main className="min-h-screen bg-[#FDFCFC]">
      {/* タイトル */}

      {/* ✅ ここで左右余白 & 上余白を付与（詰まり改善） */}
      <div className="px-4 pt-5 pb-24 text-base text-[#596377]">
        {/* アカウント */}
        <section className="space-y-3">
          <h2 className="mt-1 mb-2 text-sm font-semibold tracking-wider text-[#574143]">
            アカウント
          </h2>

          <div className="space-y-2">
            {/* プロフィールを編集 */}
            <button type="button" onClick={handleGoProfile} className={rowClass}>
              <IconBox>
                <UserIcon className="h-6 w-6 text-[#596377]" />
              </IconBox>
              <span className="text-base">プロフィールを編集</span>
            </button>

            {/* パスワードの変更（MVPはダミー） */}
            <button type="button" className={rowClass}>
              <IconBox>
                <KeyRound className="h-6 w-6 text-[#596377]" />
              </IconBox>
              <span className="text-base">パスワードの変更</span>
            </button>
          </div>
        </section>

        {/* ✅ セクション間の余白（詰まり改善） */}
        <div className="h-7" />

        {/* 設定 */}
        <section className="space-y-3">
          <h2 className="mb-2 text-sm font-semibold tracking-wider text-[#574143]">
            設定
          </h2>

          <div className="space-y-2">
            {/* 通知設定（ダミー） */}
            <button type="button" className={rowClass}>
              <IconBox>
                <Bell className="h-6 w-6 text-[#596377]" />
              </IconBox>
              <span className="text-base">通知設定</span>
            </button>

            {/* プライバシー（ダミー） */}
            <button type="button" className={rowClass}>
              <IconBox>
                <ShieldCheck className="h-6 w-6 text-[#596377]" />
              </IconBox>
              <span className="text-base">プライバシー</span>
            </button>

            {/* アプリ情報（ダミー） */}
            <button type="button" className={rowClass}>
              <IconBox>
                <Info className="h-6 w-6 text-[#596377]" />
              </IconBox>
              <span className="text-base">アプリ情報</span>
            </button>
          </div>
        </section>

        <div className="h-7" />

        {/* その他 */}
        <section className="space-y-3">
          <h2 className="mb-2 text-sm font-semibold tracking-wider text-[#574143]">
            その他
          </h2>

          {/* ログアウト */}
          <button
            type="button"
            onClick={handleLogout}
            className={`${rowClass} text-[#596377]`}
          >
            <IconBox>
              <LogOut className="h-6 w-6 text-[#596377]" />
            </IconBox>
            <span className="text-base">ログアウト</span>
          </button>
        </section>
      </div>
    </main>
  );
}
