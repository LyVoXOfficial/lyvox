"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { readImageSize } from "@/lib/image";
import { apiFetch } from "@/lib/fetcher";
import { useI18n } from "@/i18n";

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

export default function UploadGallery({ advertId, locale }: { advertId: string; locale?: string }) {
  const { t } = useI18n();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/media/list?advertId=${advertId}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!payload.ok) {
        throw new Error(payload.error ?? "FAILED_TO_LOAD_MEDIA");
      }
      setItems(
        (payload.data.items as MediaItem[]).map((item) => ({
          ...item,
          storagePath: item.storagePath ?? "",
          sort: item.sort ?? 0,
        })),
      );
    } catch (err) {
      console.error("MEDIA_LIST_ERROR", err);
      setError(t("upload.error.load_failed") || "Failed to load media files");
    }
  }, [advertId, t]);

  useEffect(() => {
    loadItems();
  }, [advertId, loadItems]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const current = items.length;
    const candidates = Array.from(files);
    if (current + candidates.length > MAX_MEDIA_PER_ADVERT) {
      setError(t("upload.error.max_files") || `Maximum ${MAX_MEDIA_PER_ADVERT} images per advert`);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      for (const file of candidates) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setError(t("upload.error.file_too_large") || "File size must not exceed 5MB");
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

        if (!signResponse.ok) {
          const errorText = await signResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: "SIGNED_UPLOAD_FAILED", message: errorText };
          }
          const errorMsg = errorData.error ?? errorData.message ?? "SIGNED_UPLOAD_FAILED";
          console.error("MEDIA_SIGN_ERROR", {
            status: signResponse.status,
            error: errorMsg,
            details: errorData.detail,
            fileName: file.name,
          });
          throw new Error(errorData.detail || errorData.message || errorMsg);
        }

        const signPayload = await signResponse.json();
        if (!signPayload.ok) {
          const errorMsg = signPayload.error ?? "SIGNED_UPLOAD_FAILED";
          console.error("MEDIA_SIGN_ERROR", {
            error: errorMsg,
            details: signPayload.detail,
            fileName: file.name,
          });
          throw new Error(signPayload.detail || signPayload.message || errorMsg);
        }

        const { path, token } = signPayload.data;
        if (!path || !token) {
          const errorMsg = "Missing path or token from sign response";
          console.error("MEDIA_SIGN_MISSING_DATA", { path: !!path, token: !!token, fileName: file.name });
          throw new Error(errorMsg);
        }

        const uploadResult = await supabase.storage
          .from("ad-media")
          .uploadToSignedUrl(path, token, file);
        if (uploadResult.error) {
          console.error("MEDIA_UPLOAD_ERROR", {
            error: uploadResult.error,
            path,
            fileName: file.name,
          });
          throw new Error(
            uploadResult.error.message || `Upload failed: ${uploadResult.error}`,
          );
        }

        // Verify upload succeeded before completing
        if (!path) {
          throw new Error("Upload succeeded but path is missing");
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

        if (!completeResponse.ok) {
          const errorText = await completeResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: "MEDIA_COMPLETE_FAILED", message: errorText };
          }
          const errorMsg = errorData.error ?? errorData.message ?? "MEDIA_COMPLETE_FAILED";
          console.error("MEDIA_COMPLETE_ERROR", {
            status: completeResponse.status,
            error: errorMsg,
            details: errorData.detail,
            path,
            fileName: file.name,
          });
          throw new Error(errorData.detail || errorData.message || errorMsg);
        }

        const completePayload = await completeResponse.json();
        if (!completePayload.ok) {
          const errorMsg = completePayload.error ?? "MEDIA_COMPLETE_FAILED";
          console.error("MEDIA_COMPLETE_ERROR", {
            error: errorMsg,
            details: completePayload.detail,
            path,
            fileName: file.name,
          });
          throw new Error(
            completePayload.detail || completePayload.message || errorMsg,
          );
        }

        const media: MediaItem = completePayload.data.media;
        setItems((prev) =>
          [...prev, media].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
        );
      }
    } catch (err) {
      console.error("MEDIA_UPLOAD_ERROR", err);
      setError(t("upload.error.upload_failed") || "Failed to upload one or more files");
    } finally {
      setBusy(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
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
      setError(t("upload.error.delete_failed") || "Failed to delete file");
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
      setError(t("upload.error.reorder_failed") || "Failed to reorder files");
      await loadItems();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => handleFiles(event.target.files)}
                disabled={busy || items.length >= MAX_MEDIA_PER_ADVERT}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                id="upload-photos-input"
              />
              <label
                htmlFor="upload-photos-input"
                className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border ${
                  busy || items.length >= MAX_MEDIA_PER_ADVERT
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:bg-accent"
                }`}
              >
                {busy
                  ? t("upload.uploading") || "Uploading..."
                  : items.length >= MAX_MEDIA_PER_ADVERT
                    ? t("upload.max_files_reached") || `Maximum ${MAX_MEDIA_PER_ADVERT} photos`
                    : t("upload.select_photos") || "Select photos"}
              </label>
            </div>
            {items.length > 0 && items.length < MAX_MEDIA_PER_ADVERT && (
              <span className="text-sm text-muted-foreground">
                ({items.length} / {MAX_MEDIA_PER_ADVERT})
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {t("upload.drag_drop_hint") || "Drag and drop images here or click to select"}
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((item, index) => (
            <div key={item.id} className="border rounded-lg p-2 relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" className="aspect-square object-cover w-full rounded" />
              <div className="mt-2 space-y-1">
                <div className="text-xs text-muted-foreground text-center">
                  {item.w ?? "?"} × {item.h ?? "?"}
                </div>
                <div className="flex justify-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => move(index, -1)}
                    disabled={busy || index === 0}
                    title={t("upload.move_up") || "Move up"}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => move(index, 1)}
                    disabled={busy || index === items.length - 1}
                    title={t("upload.move_down") || "Move down"}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-2 text-xs"
                    onClick={() => removeItem(item.id)}
                    disabled={busy}
                  >
                    {t("upload.delete") || "Delete"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {busy && <p className="text-sm text-muted-foreground text-center">{t("upload.uploading") || "Uploading..."}</p>}
    </div>
  );
}
