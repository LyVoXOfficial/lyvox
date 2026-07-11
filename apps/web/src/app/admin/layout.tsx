import type { ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/requireAdmin";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdminPage("/admin/settings");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center">
          <div className="mr-auto flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border bg-foreground text-background">
              <ClipboardList className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">LyVoX operations</p>
              <p className="mt-1 text-xs text-muted-foreground">AAL2 protected · every setting change audited</p>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      {children}
    </div>
  );
}
