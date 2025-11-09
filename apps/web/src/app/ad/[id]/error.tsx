"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset?: () => void;
};

export default function AdvertError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Advert page error boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Не удалось загрузить объявление</h1>
      <p className="text-sm text-muted-foreground">
        Возникла критическая ошибка при загрузке данных. Сообщение об ошибке показано ниже, чтобы помочь с
        диагностикой.
      </p>
      <pre className="overflow-auto rounded-md border bg-muted/40 p-4 text-sm text-foreground/90">
        {error.message || "Неизвестная ошибка"}
        {error.digest ? `\nDigest: ${error.digest}` : null}
      </pre>
      {reset ? (
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          onClick={() => reset()}
        >
          Попробовать снова
        </button>
      ) : null}
    </div>
  );
}

