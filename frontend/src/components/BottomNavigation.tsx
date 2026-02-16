// frontend/src/components/BottomNavigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  Calendar,
  Settings,
} from "lucide-react";

const tabs = [
  { href: "/", icon: Home, label: "ホーム" },
  { href: "/records", icon: ClipboardList, label: "記録" },
  { href: "/calendar", icon: Calendar, label: "カレンダー" },
  { href: "/settings", icon: Settings, label: "設定" },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 w-full max-w-[420px] md:max-w-[560px] -translate-x-1/2 bg-white shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
      <div className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== "/" && pathname.startsWith(tab.href));

          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-0.5"
            >
              <Icon
                size={22}
                className={active ? "text-[#80676a]" : "text-[#C0B4AE]"}
              />
              <span
                className={`text-[11px] leading-none ${
                  active ? "text-[#574143]" : "text-[#B4B7C0]"
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
