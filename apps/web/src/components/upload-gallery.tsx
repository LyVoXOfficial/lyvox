"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { readImageSize } from "@/lib/image";
import { apiFetch } from "@/lib/fetcher";

type MediaItem = {
  id: string;
  url: string;
  storagePath: string;
  w: number | null;
  h: number | null;
  sort: number;
};

const MAX_MEDIA_PER_ADVERT = 12;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export default function UploadGallery({ advertId }: { advertId: string }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = async () => {
    try {
      const response = await apiFetch(`/api/media/list?advertId=${advertId}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error ?? "FAILED_TO_LOAD_MEDIA");
      }
      setItems(
        (payload.items as MediaItem[]).map((item) => ({
          ...item,
          storagePath: item.storagePath ?? "",
          sort: item.sort ?? 0,
        })),
      );
    } catch (err) {
      console.error("MEDIA_LIST_ERROR", err);
      setError("Не удалось загрузить список файлов.");
    }
  };

  useEffect(() => {
    loadItems();
  }, [advertId, loadItems]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const current = items.length;
    const candidates = Array.from(files);
    if (current + candidates.length > MAX_MEDIA_PER_ADVERT) {
      setError("Максимум 12 изображений для объявления.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      for (const file of candidates) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setError("Размер файла не должен превышать 5MB.");
          continue;
        }

        const dims = await readImageSize(file).catch(() => ({ w: null, h: null }));

        const signResponse = await apiFetch("/api/media/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            advertId,
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
          }),
        });
        const signPayload = await signResponse.json();
        if (!signPayload.ok) {
          throw new Error(signPayload.error ?? "SIGNED_UPLOAD_FAILED");
        }

        const { path, token } = signPayload;
        const uploadResult = await supabase.storage
          .from("ad-media")
          .uploadToSignedUrl(path, token, file);
        if (uploadResult.error) {
          throw uploadResult.error;
        }

        const completeResponse = await apiFetch("/api/media/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            advertId,
            storagePath: path,
            width: dims.w,
            height: dims.h,
          }),
        });
        const completePayload = await completeResponse.json();
        if (!completePayload.ok) {
          throw new Error(completePayload.error ?? "MEDIA_COMPLETE_FAILED");
        }

        const media: MediaItem = completePayload.media;
        setItems((prev) =>
          [...prev, media].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
        );
      }
    } catch (err) {
      console.error("MEDIA_UPLOAD_ERROR", err);
      setError("Не удалось загрузить один или несколько файлов.");
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/media/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error ?? "MEDIA_DELETE_FAILED");
      }
      await loadItems();
    } catch (err) {
      console.error("MEDIA_DELETE_ERROR", err);
      setError("Не удалось удалить файл.");
    } finally {
      setBusy(false);
    }
  };

  const submitOrder = async (ordered: MediaItem[]) => {
    await apiFetch("/api/media/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        advertId,
        orderedIds: ordered.map((item) => item.id),
      }),
    });
    setItems(ordered);
  };

  const move = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const ordered = [...items];
    const [current] = ordered.splice(index, 1);
    ordered.splice(targetIndex, 0, current);
    ordered.forEach((item, idx) => {
      item.sort = idx;
    });
    setBusy(true);
    try {
      await submitOrder(ordered);
    } catch (err) {
      console.error("MEDIA_REORDER_ERROR", err);
      setError("Не удалось изменить порядок файлов.");
      await loadItems();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => handleFiles(event.target.files)}
        disabled={busy || items.length >= MAX_MEDIA_PER_ADVERT}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((item, index) => (
          <div key={item.id} className="border rounded p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt="" className="aspect-square object-cover w-full rounded" />
            <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
              <span>
                {item.w ?? "?"}×{item.h ?? "?"}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => move(index, -1)}
                  disabled={busy || index === 0}
                >
                  &uarr;
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => move(index, 1)}
                  disabled={busy || index === items.length - 1}
                >
                  &darr;
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removeItem(item.id)}
                  disabled={busy}
                >
                  Удалить
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {busy && <p>Загрузка...</p>}
    </div>
  );
}
