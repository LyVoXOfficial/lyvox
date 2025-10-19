"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { hasAdminRole, type SupabaseUserLike } from "@/lib/adminRole";

type MeResponse = {
  user: unknown;
  phone: { number?: string | null; verified?: boolean | null } | null;
  verifiedPhone?: boolean;
};

export default function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data: MeResponse = await response.json().catch(() => ({ user: null, phone: null }));
        if (!cancelled) {
          const rawUser = data?.user ?? null;
          let emailValue: string | null = null;
          if (rawUser && typeof rawUser === "object" && "email" in rawUser) {
            const candidate = (rawUser as { email?: unknown }).email;
            if (typeof candidate === "string") {
              emailValue = candidate;
            }
          }
          setEmail(emailValue);
          setIsAdmin(hasAdminRole(rawUser as SupabaseUserLike));

          const verifiedFromPhone = typeof data?.phone?.verified === "boolean" ? data.phone.verified : null;
          const verifiedFallback = typeof data?.verifiedPhone === "boolean" ? data.verifiedPhone : null;
          setPhoneVerified(verifiedFromPhone ?? verifiedFallback);
        }
      } catch {
        if (!cancelled) {
          setEmail(null);
          setIsAdmin(false);
          setPhoneVerified(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const closeMenu = useCallback(() => setOpen(false), []);

  const signOut = async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.replace("/");
    }
  };

  if (!email) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Войти
        </Link>
        <Link
          href="/register"
          className="rounded-xl border border-primary bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Регистрация
        </Link>
      </div>
    );
  }

  const showPhoneVerification = phoneVerified === false;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="hidden sm:inline">{email}</span>
        <span className="sm:hidden">Аккаунт</span>
        <svg className="h-3 w-3 text-muted-foreground" viewBox="0 0 12 8" aria-hidden>
          <path d="M10.59 1.59 6 6.17 1.41 1.59 0 3l6 6 6-6z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-56 rounded-xl border bg-white p-2 shadow-lg"
        >
          <Link
            href="/profile"
            onClick={closeMenu}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-muted"
            role="menuitem"
          >
            Профиль
          </Link>
          <Link
            href="/profile/ads"
            onClick={closeMenu}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-muted"
            role="menuitem"
          >
            Мои объявления
          </Link>
          {showPhoneVerification && (
            <Link
              href="/profile/phone"
              onClick={closeMenu}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-muted"
              role="menuitem"
            >
              Верификация телефона
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin/reports"
              onClick={closeMenu}
              className="mt-1 block rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              role="menuitem"
            >
              Админ-панель
            </Link>
          )}
          <button
            type="button"
            onClick={signOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            role="menuitem"
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}
