type DetailItem = {
  label: string;
  value: string;
};

type AdvertDetailsProps = {
  title: string;
  details: DetailItem[];
  optionsTitle?: string;
  options?: string[];
};

export default function AdvertDetails({
  title,
  details,
  optionsTitle,
  options = [],
}: AdvertDetailsProps) {
  const hasDetails = details.length > 0;
  const hasOptions = options.length > 0;

  if (!hasDetails && !hasOptions) {
    return null;
  }

  return (
    <section className="space-y-6 rounded-lg border p-4">
      {hasDetails ? (
        <div>
          <h2 className="mb-3 text-lg font-medium">{title}</h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.map((item) => (
              <div key={`${item.label}-${item.value}`} className="rounded-md bg-muted/40 p-3">
                <dt className="text-xs uppercase text-muted-foreground">{item.label}</dt>
                <dd className="text-sm font-medium text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {hasOptions ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground/80">
            {optionsTitle}
          </h3>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <span
                key={option}
                className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
              >
                {option}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

