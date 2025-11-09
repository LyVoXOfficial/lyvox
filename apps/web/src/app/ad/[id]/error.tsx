"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset?: () => void;
};

const isDevEnvironment = process.env.NODE_ENV !== "production";

export default function AdvertError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Advert page error boundary:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const errorLines = [
    error.message || "Неизвестная ошибка",
    isDevEnvironment && error.stack ? `Stack:\n${error.stack}` : null,
    error.digest ? `Digest: ${error.digest}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Не удалось загрузить объявление</h1>
      <p className="text-sm text-muted-foreground">
        Возникла критическая ошибка при загрузке данных. Сообщение об ошибке показано ниже, чтобы помочь с
        диагностикой. В рабочем окружении подробности скрыты.
      </p>
      <pre className="overflow-auto rounded-md border bg-muted/40 p-4 text-sm text-foreground/90">
        {errorLines.join("\n\n")}
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

