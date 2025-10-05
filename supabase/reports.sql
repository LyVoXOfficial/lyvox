-- 1. UTILITY FUNCTION: Automatically update the 'updated_at' timestamp
----------------------------------------------------------------------
-- Это стандартная функция Supabase для автоматического обновления метки времени при любом изменении строки.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. REPORTS TABLE: Хранение жалоб
----------------------------------------------------------------------
create table if not exists reports (
    id bigserial primary key,
    -- Важно: предполагает, что таблица 'adverts' и 'auth.users' уже существуют
    advert_id uuid not null references adverts(id) on delete cascade,
    reporter uuid not null references auth.users(id) on delete cascade,
    reason text not null,
    details text,
    status text not null default 'pending', -- pending, accepted, rejected
    reviewed_by uuid, -- кем рассмотрено
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Индексы для ускорения запросов
create index if not exists reports_advert_idx on reports(advert_id);
create index if not exists reports_status_idx on reports(status);
create index if not exists reports_reporter_idx on reports(reporter);

-- Применить триггер set_updated_at
CREATE TRIGGER set_updated_at_reports
BEFORE UPDATE ON reports
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at();

-- Настройка Row Level Security (RLS)
alter table reports enable row level security;

-- 2.1. REPORTS POLICIES:
-- Пользователь может просматривать: 
-- 1. Свои собственные отправленные жалобы (reporter = auth.uid())
-- 2. Жалобы, относящиеся к его объявлениям (advert_id принадлежит его advert.user_id)
create policy "Allow user to select own sent reports or reports on their adverts" on reports
for select to authenticated
using (
    reporter = auth.uid()
    or exists (
        select 1 from adverts a where a.id = reports.advert_id and a.user_id = auth.uid()
    )
);

-- Пользователь может только вставлять жалобу от своего имени
create policy "Allow authenticated user to insert own report" on reports
for insert to authenticated
with check (reporter = auth.uid());

-- Политики UPDATE/DELETE для модераторов/админов должны быть добавлены отдельно (или разрешены через RLS для роли 'service_role')


-- 3. TRUST_SCORE TABLE: Хранение баллов доверия
----------------------------------------------------------------------
create table if not exists trust_score (
    user_id uuid primary key references auth.users(id) on delete cascade,
    score int not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Применить триггер set_updated_at
CREATE TRIGGER set_updated_at_trust_score
BEFORE UPDATE ON trust_score
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at();

-- Настройка RLS для trust_score (поскольку она управляется функцией, не даем прямой доступ)
alter table trust_score enable row level security;
-- Политика SELECT: каждый может видеть свой собственный счет (если он есть)
create policy "Allow user to read own trust score" on trust_score
for select to authenticated
using (user_id = auth.uid());
-- Политики INSERT/UPDATE/DELETE: Запретить прямой доступ пользователям. Только функция trust_inc() должна изменять эту таблицу.


-- 4. TRUST_INC FUNCTION: Функция для атомарного обновления счета доверия
----------------------------------------------------------------------
create or replace function trust_inc(uid uuid, pts int)
returns void as $$
begin
    insert into trust_score(user_id, score) values (uid, pts)
    on conflict (user_id)
    do update set 
        score = trust_score.score + excluded.score,
        updated_at = now();
end;
$$ language plpgsql;
