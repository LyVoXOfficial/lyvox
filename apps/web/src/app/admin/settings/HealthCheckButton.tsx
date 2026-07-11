"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function HealthCheckButton({
  integrationId,
}: {
  integrationId: string;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const response = await fetch(
        `/api/admin/integrations/${encodeURIComponent(integrationId)}/health`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!response.ok) throw new Error("health_check_failed");
      toast.success("Health evidence updated");
      router.refresh();
    } catch {
      toast.error("Health check failed. Review configuration and try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={run}
      disabled={running}
    >
      <Activity className="size-3.5" aria-hidden="true" />
      {running ? "Checking…" : "Check"}
    </Button>
  );
}
