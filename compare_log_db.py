import csv
from pathlib import Path
import re

sql_path = Path('backups/2025-10-30_remote.sql')
log_path = Path('logs/vehicle_i18n_expand.csv')

pattern = re.compile(r'^COPY\s+public\.vehicle_generation_i18n\s+\(([^)]+)\)\s+FROM\s+stdin;')
fields = None
rows = {}
with sql_path.open(encoding='utf-8') as f:
    for line in f:
        line = line.rstrip('\n')
        if fields is None:
            m = pattern.match(line)
            if m:
                fields = [c.strip() for c in m.group(1).split(',')]
                continue
        else:
            if line == '\\.':
                break
            if not line.strip():
                continue
            parts = line.split('\t')
            data = dict(zip(fields, parts))
            key = (data['generation_id'], data['locale'])
            rows[key] = data

log_rows = {}
with log_path.open(encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for r in reader:
        key = (r['generation_id'], r['locale_written'])
        entry = log_rows.setdefault(key, {'summary': None, 'pros': [], 'cons': [], 'inspection_tips': []})
        field = r['field_name']
        if field == 'summary':
            entry['summary'] = r['translated_snippet']
        elif field in ('pros', 'cons', 'inspection_tips'):
            if r['translated_snippet'] not in entry[field]:
                entry[field].append(r['translated_snippet'])

missing_in_backup = []
missing_in_log = []
content_diffs = []
for key, log_entry in log_rows.items():
    if key not in rows:
        missing_in_backup.append(key)
        continue
    db_entry = rows[key]
    summary_db = db_entry['summary']
    if summary_db == '\\N':
        summary_db = None
    if log_entry['summary'] and summary_db and log_entry['summary'].strip() != summary_db.strip():
        content_diffs.append((key, 'summary', summary_db, log_entry['summary']))
    elif log_entry['summary'] and summary_db is None:
        content_diffs.append((key, 'summary', summary_db, log_entry['summary']))

    def parse_array(value):
        if value == '\\N':
            return None
        if value == '{}':
            return []
        inner = value.strip('{}')
        if not inner:
            return []
        items = []
        current = []
        in_quotes = False
        escaped = False
        for ch in inner:
            if escaped:
                current.append(ch)
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == '"':
                in_quotes = not in_quotes
            elif ch == ',' and not in_quotes:
                items.append(''.join(current))
                current = []
            else:
                current.append(ch)
        items.append(''.join(current))
        return [item.replace('""', '"') for item in items]

    for field in ('pros', 'cons', 'inspection_tips'):
        db_list = parse_array(db_entry[field])
        log_list = log_entry[field]
        if db_list is None:
            db_list = []
        if log_list and not db_list:
            content_diffs.append((key, field, db_list, log_list))
        elif log_list and db_list:
            if len(db_list) != len(log_list) or any(a.strip() != b.strip() for a, b in zip(db_list, log_list)):
                content_diffs.append((key, field, db_list, log_list))

for key in rows.keys():
    if key not in log_rows:
        missing_in_log.append(key)

print('log combos:', len(log_rows))
print('backup combos:', len(rows))
print('missing_in_backup:', len(missing_in_backup))
print('missing_in_log:', len(missing_in_log))
print('content diffs:', len(content_diffs))
if content_diffs:
    for diff in content_diffs[:10]:
        print(repr(diff))
