"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase";
import { authFetch } from "@/lib/api";
import { LayoutShell } from "@/components/LayoutShell";

type AuthState = "checking" | "authed" | "guest";
type ProfileState = "checking" | "complete" | "incomplete";

type UserProfile = {
  skin_type: string | null;
  cycle_length_days: number | null;
  last_menstruation_start: string | null;
  pref_code: string | null;
};

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [profileState, setProfileState] = useState<ProfileState>("checking");
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [dailyNudgeKey, setDailyNudgeKey] = useState<string | null>(null);

  const isPublicPath = useMemo(() => pathname === "/login", [pathname]);
  const isProfileAllowedPath = useMemo(
    () =>
      pathname === "/profile" ||
      pathname === "/settings" ||
      pathname.startsWith("/settings/"),
    [pathname],
  );
  const isDebugPath = useMemo(
    () => pathname.startsWith("/debug/"),
    [pathname],
  );

  const isProfileComplete = (profile: UserProfile) =>
    Boolean(
      profile.pref_code &&
        profile.skin_type &&
        profile.cycle_length_days != null &&
        profile.last_menstruation_start,
    );

  useEffect(() => {
    if (isPublicPath) return;

    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthState("guest");
      setCurrentUid(null);
      setDailyNudgeKey(null);
      router.replace("/login");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAuthState("guest");
        setCurrentUid(null);
        setDailyNudgeKey(null);
        router.replace("/login");
        return;
      }
      setAuthState("authed");
      setCurrentUid(user.uid);
      setDailyNudgeKey(null);
    });

    return () => unsubscribe();
  }, [isPublicPath, router]);

  useEffect(() => {
    const handleProfileUpdated = () =>
      setProfileRefreshKey((value) => value + 1);
    window.addEventListener("profile-updated", handleProfileUpdated);
    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, []);

  useEffect(() => {
    if (isPublicPath || authState !== "authed") return;

    let cancelled = false;

    const checkProfile = async () => {
      try {
        setProfileState("checking");
        const res = await authFetch("/users/me", { method: "GET" });

        if (res.status === 401) {
          if (!cancelled) {
            setAuthState("guest");
            router.replace("/login");
          }
          return;
        }

        if (res.status === 404 || res.status === 204) {
          if (!cancelled) setProfileState("incomplete");
          return;
        }

        if (!res.ok) {
          throw new Error(`Failed to fetch profile: ${res.status}`);
        }

        const profile: UserProfile = await res.json();
        const complete = isProfileComplete(profile);
        console.log("[debug][AuthGate] /users/me profile:", profile);
        console.log("[debug][AuthGate] isProfileComplete:", complete);
        if (!cancelled) {
          setProfileState(complete ? "complete" : "incomplete");
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setProfileState("incomplete");
      }
    };

    checkProfile();

    return () => {
      cancelled = true;
    };
  }, [authState, isPublicPath, profileRefreshKey, router]);

  useEffect(() => {
    if (isPublicPath || authState !== "authed") return;
    if (isDebugPath) return;
    if (profileState !== "complete") return;
    if (pathname.startsWith("/records")) return;
    if (pathname.startsWith("/cycles")) return;
    if (!currentUid) return;

    const today = formatDate(new Date());
    const key = `${currentUid}:${today}`;
    if (dailyNudgeKey === key) return;

    let cancelled = false;

    const checkTodayRecord = async () => {
      try {
        const res = await authFetch(`/records/${today}`, { method: "GET" });
        if (cancelled) return;

        if (res.status === 404) {
          setDailyNudgeKey(key);
          router.replace("/records");
          return;
        }
        if (res.ok) {
          setDailyNudgeKey(key);
        }
      } catch (err) {
        console.error(err);
      }
    };

    checkTodayRecord();

    return () => {
      cancelled = true;
    };
  }, [
    authState,
    currentUid,
    dailyNudgeKey,
    isDebugPath,
    isPublicPath,
    pathname,
    profileState,
    router,
  ]);

  useEffect(() => {
    if (isPublicPath || authState !== "authed") return;
    if (profileState === "incomplete" && !isProfileAllowedPath) {
      router.replace("/profile");
    }
  }, [authState, isProfileAllowedPath, isPublicPath, profileState, router]);

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (authState === "checking" || profileState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#7F7066]">
        読み込み中...
      </div>
    );
  }

  if (authState === "guest") {
    return null;
  }

  if (profileState === "incomplete" && !isProfileAllowedPath) {
    return null;
  }

  return <LayoutShell>{children}</LayoutShell>;
}
