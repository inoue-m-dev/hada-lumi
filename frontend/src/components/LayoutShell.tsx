"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import { BottomNavigation } from "@/components/BottomNavigation";

type Props = {
  children: React.ReactNode;
};

export function LayoutShell({ children }: Props) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <div className="min-h-screen bg-[#FDFCFC] flex flex-col">
      {!isLoginPage && (
        <header className="border-b border-[#E2D3C5] pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex h-13 w-full max-w-[420px] md:max-w-[560px] items-center px-4">
            <Image
              src="/images/logo-title.png"
              alt="Hada Lumi"
              width={160}
              height={40}
              priority
              className="h-10 w-auto opacity-85"
            />
          </div>
        </header>
      )}

      <main className="mx-auto w-full max-w-[420px] md:max-w-[560px] flex-1 min-h-0 overflow-y-auto pb-16 md:pb-24">
        {children}
      </main>

      {!isLoginPage && <BottomNavigation />}
    </div>
  );
}
