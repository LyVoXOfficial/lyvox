"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { readImageSize } from "@/lib/image";
import { apiFetch } from "@/lib/fetcher";
import { useI18n } from "@/i18n";
import { Eye, GripVertical, Loader2, Star, Trash2 } from "lucide-react";

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
  const [statusKey, setStatusKey] = useState<"uploading" | "reordering" | "deleting" | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
    setStatusKey("uploading");
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
      setStatusKey(null);
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
    setStatusKey("deleting");
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
      setStatusKey(null);
    }
  };

  const submitOrder = useCallback(
    async (ordered: MediaItem[]) => {
      const response = await apiFetch("/api/media/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertId,
          orderedIds: ordered.map((item) => item.id),
        }),
      });

      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok || (payload && payload.ok === false)) {
        const message = payload?.error ?? "MEDIA_REORDER_FAILED";
        throw new Error(message);
      }
    },
    [advertId],
  );

  const handleReorder = useCallback(
    async (sourceIndex: number, targetIndex: number) => {
      if (sourceIndex === targetIndex) {
        return;
      }

      const previous = [...items];
      const next = [...items];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      next.forEach((item, idx) => {
        item.sort = idx;
      });

      setItems(next);
      setBusy(true);
      setStatusKey("reordering");
      setError(null);
      try {
        await submitOrder(next);
      } catch (err) {
        console.error("MEDIA_REORDER_ERROR", err);
        setError(t("upload.error.reorder_failed") || "Failed to reorder files");
        setItems(previous);
        await loadItems();
      } finally {
        setBusy(false);
        setStatusKey(null);
      }
    },
    [items, submitOrder, t, loadItems],
  );

  const handleSetCover = useCallback(
    async (index: number) => {
      if (index === 0 || busy) {
        return;
      }
      await handleReorder(index, 0);
    },
    [handleReorder, busy],
  );

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      if (busy) {
        event.preventDefault();
        return;
      }
      setDraggedIndex(index);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    },
    [busy],
  );

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      if (draggedIndex === null || busy) {
        return;
      }
      event.preventDefault();
      if (index !== draggedIndex) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex, busy],
  );

  const handleDragOverItem = useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      if (draggedIndex === null || busy) {
        return;
      }
      event.preventDefault();
      if (dragOverIndex !== index) {
        setDragOverIndex(index);
      }
      event.dataTransfer.dropEffect = "move";
    },
    [draggedIndex, dragOverIndex, busy],
  );

  const handleDragLeave = useCallback(() => {
    if (draggedIndex !== null) {
      setDragOverIndex(null);
    }
  }, [draggedIndex]);

  const handleDropItem = useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      event.stopPropagation();
      if (draggedIndex === null) {
        return;
      }
      handleReorder(draggedIndex, index);
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, handleReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleContainerDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (draggedIndex === null || busy) {
        return;
      }
      handleReorder(draggedIndex, items.length - 1);
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, busy, handleReorder, items.length],
  );

  const handleContainerDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (draggedIndex === null || busy) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    [draggedIndex, busy],
  );

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
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
          onDragOver={handleContainerDragOver}
          onDrop={handleContainerDrop}
        >
          {items.map((item, index) => {
            const isDragged = draggedIndex === index;
            const isDropTarget = dragOverIndex === index && draggedIndex !== null && draggedIndex !== index;
            return (
              <div
                key={item.id}
                className={`group relative rounded-lg border p-2 transition-all ${
                  isDropTarget ? "border-primary ring-2 ring-primary/40" : "border-border"
                } ${isDragged ? "opacity-60" : ""}`}
                draggable={!busy}
                onDragStart={(event) => handleDragStart(event, index)}
                onDragEnter={(event) => handleDragEnter(event, index)}
                onDragOver={(event) => handleDragOverItem(event, index)}
                onDragLeave={handleDragLeave}
                onDrop={(event) => handleDropItem(event, index)}
                onDragEnd={handleDragEnd}
              >
                {index === 0 ? (
                  <Badge className="absolute top-2 left-2 z-20 uppercase">
                    {t("upload.cover") || "Cover"}
                  </Badge>
                ) : null}
                <div className="absolute top-2 left-2 z-20 text-muted-foreground/70">
                  <GripVertical className="h-4 w-4" />
                  <span className="sr-only">{t("upload.drag_to_reorder") || "Drag to reorder"}</span>
                </div>
                <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={() => setPreviewItem(item)}
                    disabled={busy}
                    title={t("upload.preview") || "Preview"}
                  >
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">{t("upload.preview") || "Preview"}</span>
                  </Button>
                  {index > 0 && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => handleSetCover(index)}
                      disabled={busy}
                      title={t("upload.set_cover") || "Set as cover"}
                    >
                      <Star className="h-4 w-4" />
                      <span className="sr-only">{t("upload.set_cover") || "Set as cover"}</span>
                    </Button>
                  )}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="aspect-square w-full rounded object-cover"
                />
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {(item.w ?? "—")}{item.w && item.h ? " × " : ""}{item.h ?? ""}
                    </span>
                    <span>{t("upload.drag_to_reorder") || "Drag to reorder"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => removeItem(item.id)}
                      disabled={busy}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      {t("upload.delete") || "Delete"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {busy && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {statusKey && t(`upload.${statusKey}` as any)
            ? t(`upload.${statusKey}` as any)
            : statusKey === "reordering"
              ? "Reordering..."
              : statusKey === "deleting"
                ? "Deleting photo..."
                : t("upload.uploading") || "Uploading..."}
        </p>
      )}

      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("upload.preview") || "Preview"}</DialogTitle>
          </DialogHeader>
          {previewItem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewItem.url}
              alt=""
              className="w-full rounded object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
