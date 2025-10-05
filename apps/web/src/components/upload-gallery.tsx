"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { readImageSize } from "@/lib/image";

function sanitizeFileName(name: string) {
  // убираем диакритику/кириллицу → латиница, пробелы → '-', всё лишнее выкинуть
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}


type Media = {
  id: string;
  url: string;
  w: number | null;
  h: number | null;
  sort: number | null;
};

export default function UploadGallery({ advertId }: { advertId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    (async () => {
      const { data } = await supabase
        .from("media")
        .select("*")
        .eq("advert_id", advertId)
        .order("sort", { ascending: true });
      setItems((data as any) ?? []);
    })();
  }, [advertId]);

  const onFiles = async (files: FileList | null) => {
    if (!files || !userId) return;
    const list = Array.from(files).slice(0, 10);
    setBusy(true);
    let baseSort = (items.at(-1)?.sort ?? 0) + 1;

    for (const file of list) {
      try {
        const { w, h } = await readImageSize(file);
        const safe = sanitizeFileName(file.name);
        const pathname = `${userId}/${advertId}/${Date.now()}-${safe}`;


        const { error: upErr } = await supabase.storage
          .from("ad-media")
          .upload(pathname, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;

        const { data: pub } = supabase.storage.from("ad-media").getPublicUrl(pathname);
        const url = pub.publicUrl;

        const { data: m, error: insErr } = await supabase
          .from("media")
          .insert({ advert_id: advertId, url, w, h, sort: baseSort })
          .select("*")
          .single();
        if (insErr) throw insErr;

        baseSort += 1;
        setItems((prev) => [...prev, m as any]);
      } catch (e: any) {
        alert("Ошибка загрузки: " + e.message);
      }
    }
    setBusy(false);
  };

  const removeItem = async (m: Media) => {
    if (!userId) return;
    setBusy(true);
    try {
      const idx = m.url.indexOf("/object/public/ad-media/");
      const path = m.url.substring(idx + "/object/public/ad-media/".length);

      await supabase.storage.from("ad-media").remove([path]);
      await supabase.from("media").delete().eq("id", m.id);

      setItems((prev) => prev.filter((x) => x.id !== m.id));
    } finally {
      setBusy(false);
    }
  };

  const move = async (m: Media, dir: -1 | 1) => {
    const target = items.find((x) => x.sort === (m.sort ?? 0) + dir);
    if (!target) return;
    await supabase.from("media").update({ sort: target.sort }).eq("id", m.id);
    await supabase.from("media").update({ sort: m.sort }).eq("id", target.id);

    const { data } = await supabase
      .from("media")
      .select("*")
      .eq("advert_id", advertId)
      .order("sort", { ascending: true });
    setItems((data as any) ?? []);
  };

  return (
    <div className="space-y-3">
      <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} disabled={busy || !userId} />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((m) => (
          <div key={m.id} className="border rounded p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt="" className="aspect-square object-cover w-full rounded" />
            <div className="flex justify-between items-center mt-2 text-sm">
              <span>{m.w}×{m.h}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => move(m, -1)}>&uarr;</Button>
                <Button size="sm" variant="outline" onClick={() => move(m, 1)}>&darr;</Button>
                <Button size="sm" variant="destructive" onClick={() => removeItem(m)}>Удалить</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {busy && <p>Загружаем…</p>}
    </div>
  );
}
