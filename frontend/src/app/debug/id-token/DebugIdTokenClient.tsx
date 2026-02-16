"use client";

import { useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";

export default function DebugIdTokenClient() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  };

  const handleGetToken = async () => {
    setStatus(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth?.currentUser;
      if (!user) {
        setStatus("ログイン中のユーザーが見つかりません。");
        return;
      }
      const idToken = await user.getIdToken();
      setToken(idToken);
      try {
        const copied = await copyToClipboard(idToken);
        setStatus(
          copied
            ? "IDトークンをコピーしました。"
            : "コピーに失敗したため、画面から手動でコピーしてください。",
        );
      } catch (error) {
        console.error("Clipboard write failed:", error);
        setStatus("コピーに失敗したため、画面から手動でコピーしてください。");
      }
    } catch (error) {
      console.error("Failed to get ID token:", error);
      setStatus("IDトークンの取得に失敗しました。");
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F1EC] text-[#2B211A]">
      <div className="mx-auto min-h-screen max-w-md bg-white shadow-md px-4 py-6 space-y-4">
        <h1 className="text-base font-semibold text-[#3B2720]">
          開発用 ID トークン
        </h1>
        <p className="text-sm text-[#7F7066]">
          ログイン済みのユーザーから ID トークンを取得します。Swagger の
          Authorize に貼り付けてください。
        </p>
        <button
          type="button"
          onClick={handleGetToken}
          className="w-full rounded-full bg-[#171412] px-4 py-3 text-sm font-semibold text-white"
        >
          IDトークンを取得してコピー
        </button>
        {status && <p className="text-xs text-[#7F7066]">{status}</p>}
        {token && (
          <textarea
            className="w-full rounded-lg border border-[#E2D3C5] p-3 text-xs text-[#3B2720]"
            rows={6}
            readOnly
            value={token}
          />
        )}
      </div>
    </main>
  );
}
