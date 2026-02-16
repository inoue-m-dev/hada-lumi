// frontend/src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { Zen_Maru_Gothic } from "next/font/google";
import Image from "next/image";
import { getFirebaseAuth } from "@/lib/firebase";
import { postAuthVerify } from "@/lib/api";

const rounded = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const provider = new GoogleAuthProvider();
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error("Firebase が初期化されていません。");
      }

      // Googleログイン
      const result = await signInWithPopup(auth, provider);

      // Firebase ID Token を backend に送って user 作成/取得
      const idToken = await result.user.getIdToken();
      const verifyRes = await postAuthVerify(idToken);
      if (!verifyRes.ok) {
        throw new Error(`認証の検証に失敗しました（${verifyRes.status}）`);
      }

      // ログイン成功 → ホームへ
      router.push("/");
    } catch (error) {
      console.error(error);
      setErrorMessage("ログインに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="lumi-login min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm space-y-10">
        <header className="flex flex-col items-center gap-4 pt-0 -mt-16">
          <div className="relative lumi-logo-veil">
            <Image
              src="/images/logo-title.png"
              alt="Hada Lumi"
              width={240}
              height={96}
              className="h-24 w-auto opacity-80 drop-shadow-sm relative z-10"
            />
          </div>
          <div className="text-center space-y-1">
            <p
              className={`${rounded.className} lumi-reveal-title text-base font-medium text-[#9A8578]`}
            >
              肌ログ・ゆらぎ分析
            </p>
          </div>
        </header>

        <main className="space-y-8">
          <section className="text-center space-y-2">

            <p
              className={`${rounded.className} lumi-reveal-body text-sm font-normal text-[#9A8578]`}
            >
              肌と生活のログから、肌ゆらぎの原因を見える化・分析
            </p>
          </section>

          {errorMessage && (
            <p className="text-xs text-red-500 text-center">
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold border border-[#E6E7EB] bg-[#D19EA3] text-[#FDFCFC] shadow-sm disabled:opacity-60"
          >
            <span className="text-base leading-none"></span>
            <span>{isLoading ? "ログイン中..." : "Googleでログイン"}</span>
          </button>

          <section className="space-y-1 text-left pl-2">
            <p className="text-[11px] text-[#B4B7C0]">
              初回ログイン時に、Hada Lumi のアカウントが自動作成されます。
            </p>
            <p className="text-[11px] text-[#B4B7C0]">
            Googleアカウントを使用します
            </p>            
            <p className="text-[11px] text-[#B4B7C0]">
              Googleアカウントがない場合は、アカウント作成からお願いします。
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
