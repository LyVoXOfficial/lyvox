import csv
from collections import OrderedDict
from pathlib import Path


LOG_PATH = Path("logs/vehicle_i18n_expand.csv")
OUTPUT_PATH = Path("supabase/migrations/20251101100500_sync_vehicle_generation_i18n.sql")


def sanitize_text(value: str) -> str:
  """
  Prepare string for SQL literal by escaping single quotes.
  """
  return value.replace("'", "''")


def array_sql(items):
  """
  Render a list of strings as a PostgreSQL text array literal (ARRAY[...]::text[]).
  """
  if not items:
    return "ARRAY[]::text[]"
  inner = ", ".join(f"'{sanitize_text(item)}'" for item in items)
  return f"ARRAY[{inner}]"


def main():
  if not LOG_PATH.exists():
    raise FileNotFoundError(f"CSV log not found at {LOG_PATH}")

  aggregated = OrderedDict()

  with LOG_PATH.open(encoding="utf-8", newline="") as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
      key = (row["generation_id"], row["locale_written"])
      entry = aggregated.setdefault(
        key,
        {"summary": None, "pros": [], "cons": [], "inspection_tips": []},
      )

      field = row["field_name"]
      snippet = (row["translated_snippet"] or "").strip()
      if not snippet:
        continue

      if field == "summary":
        entry["summary"] = snippet
      elif field in entry:
        if snippet not in entry[field]:
          entry[field].append(snippet)

  lines = []
  lines.append("-- Sync vehicle_generation_i18n content from latest localisation log")
  lines.append("begin;")
  lines.append(
    "insert into public.vehicle_generation_i18n "
    "(generation_id, locale, summary, pros, cons, inspection_tips) values"
  )

  items = list(aggregated.items())
  for index, ((generation_id, locale), data) in enumerate(items):
    summary = data["summary"]
    summary_sql = f"'{sanitize_text(summary)}'" if summary else "NULL"
    pros_sql = array_sql(data["pros"])
    cons_sql = array_sql(data["cons"])
    tips_sql = array_sql(data["inspection_tips"])

    value = (
      f"  ('{generation_id}', '{locale}', {summary_sql}, "
      f"{pros_sql}, {cons_sql}, {tips_sql})"
    )
    if index < len(items) - 1:
      value += ","
    lines.append(value)

  lines.append(
    "on conflict (generation_id, locale) do update set"
  )
  lines.append(
    "  summary = coalesce(excluded.summary, public.vehicle_generation_i18n.summary),"
  )
  lines.append(
    "  pros = case when coalesce(array_length(excluded.pros, 1), 0) = 0 "
    "then public.vehicle_generation_i18n.pros else excluded.pros end,"
  )
  lines.append(
    "  cons = case when coalesce(array_length(excluded.cons, 1), 0) = 0 "
    "then public.vehicle_generation_i18n.cons else excluded.cons end,"
  )
  lines.append(
    "  inspection_tips = case when coalesce(array_length(excluded.inspection_tips, 1), 0) = 0 "
    "then public.vehicle_generation_i18n.inspection_tips else excluded.inspection_tips end;"
  )
  lines.append("commit;")

  OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
  OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
  print(f"Wrote SQL with {len(items)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
  main()
