"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncGoogleNowAction } from "../server/gcal.actions";

export function SyncNowButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const r = await syncGoogleNowAction();
          if (!r.ok) toast.error(r.message);
          else {
            const s = r.data;
            toast.success(
              `Sincronizado: ${s.imported} nuevas de WhatsApp, ${s.pushed} enviadas a Google` +
                (s.cancelledFromGoogle ? `, ${s.cancelledFromGoogle} canceladas` : ""),
            );
          }
          router.refresh();
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} /> {pending ? "Sincronizando…" : "Sincronizar ahora"}
    </Button>
  );
}
