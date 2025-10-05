"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { hasAdminRole } from "@/lib/adminRole";

export default function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
        const data = await response.json().catch(() => null);
        if (!cancelled) {
          const user = data?.user ?? null;
          setEmail(user?.email ?? null);
          setIsAdmin(hasAdminRole(user));
        }
      } catch {
        if (!cancelled) {
          setEmail(null);
          setIsAdmin(false);
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
      <Link
        href="/login"
        className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        ����
      </Link>
    );
  }

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
        <span className="sm:hidden">������</span>
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
            ��䨫�
          </Link>
          <Link
            href="/profile/ads"
            onClick={closeMenu}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-muted"
            role="menuitem"
          >
            ��� �������
          </Link>
          <Link
            href="/profile/phone"
            onClick={closeMenu}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-muted"
            role="menuitem"
          >
            ���䨪��� ⥫�䮭�
          </Link>
          {isAdmin && (
            <Link
              href="/admin/reports"
              onClick={closeMenu}
              className="mt-1 block rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              role="menuitem"
            >
              ������ �����樨
            </Link>
          )}
          <button
            type="button"
            onClick={signOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            role="menuitem"
          >
            ���
          </button>
        </div>
      )}
    </div>
  );
}
