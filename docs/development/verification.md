# Верификация аккаунта

## Current Implementation

| Метод | Статус | Endpoint |
|-------|--------|----------|
| Email | Работает | Supabase magic link (автоматически) |
| Phone | Работает | `/api/phone/request`, `/api/phone/verify` |

## MVP Scope

### Email Verification

**Flow:**
1. При регистрации Supabase отправляет magic link
2. Пользователь кликает на ссылку в email
3. Supabase обновляет `auth.users.email_confirmed_at`
4. Приложение проверяет статус: `profiles.verified_email`

**Отображение:**
- Badge "✓ Verified Email" в профиле
- Badge на карточке объявления (если продавец верифицирован)

### Phone Verification

**Flow:**
1. Пользователь запрашивает OTP: `POST /api/phone/request`
2. Twilio отправляет SMS с кодом
3. Пользователь вводит код: `POST /api/phone/verify`
4. После успешной верификации: `profiles.verified_phone = true`

**Rate Limiting:**
- 5 запросов / 15 минут на пользователя
- 20 запросов / 60 минут на IP

**Отображение:**
- Badge "✓ Verified Phone" в профиле
- Badge на карточке объявления

### Визуальные индикаторы

**Badge компонент:**
```typescript
<VerificationBadge 
  email={profile.verified_email}
  phone={profile.verified_phone}
  itsme={profile.itsme_verified} // Post-MVP
/>
```

**Фильтр в поиске:**
- Чекбокс "Только верифицированные продавцы"
- Показывает только объявления от продавцов с `verified_email = true` или `verified_phone = true`

## Itsme Integration (Post-MVP)

### OAuth Flow

**Настройка в Supabase:**
1. Добавить Itsme provider в Supabase Auth
2. Настроить redirect URL: `https://lyvox.be/api/auth/itsme/callback`

**Flow:**
1. Пользователь кликает "Sign in with Itsme"
2. Редирект на Itsme OAuth
3. После успешной аутентификации: callback → `/api/auth/itsme/callback`
4. Обновление профиля: `profiles.itsme_verified = true`
5. KYC level определяется Itsme (базовый/расширенный)

**Database:**
```sql
ALTER TABLE public.profiles ADD COLUMN itsme_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN itsme_kyc_level text; -- 'basic', 'advanced'
```

**API Endpoint:**
```typescript
// apps/web/src/app/api/auth/itsme/callback/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  // Exchange code for token
  // Update profile with itsme_verified = true
  // Redirect to profile page
}
```

## KBO/BCE API (для бизнеса)

### Описание

Проверка регистрации компании по номеру:
- Бельгия (BE): KBO (Kruispuntbank van Ondernemingen)
- Франция (FR): BCE (Bases de Données Centrales d'Entreprises)

### Database

```sql
ALTER TABLE public.profiles ADD COLUMN business_type text; -- 'individual', 'business'
ALTER TABLE public.profiles ADD COLUMN business_registration_number text;
ALTER TABLE public.profiles ADD COLUMN business_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN business_verified_at timestamptz;
```

### API Endpoint

```typescript
POST /api/profile/verify-business
Body: {
  registrationNumber: string,
  country: 'BE' | 'FR'
}

// Валидация через внешний API
// Сохранение результата в профиле
```

### External API Integration

**Пример для KBO (BE):**
- API: https://kbopub.economie.fgov.be/kbopub/zoeknummerform.html
- Или через официальный API если доступен

**Пример для BCE (FR):**
- API: https://api.insee.fr/entreprises/sirene/v3/
- Требуется API key

## Чек-лист MVP

- [ ] Email verification badge (после подтверждения email)
- [ ] Phone verification badge (после OTP)
- [ ] Визуальные индикаторы: badge в профиле
- [ ] Визуальные индикаторы: badge на карточках объявлений
- [ ] Фильтр "Только верифицированные" в поиске

## Чек-лист Post-MVP

- [ ] Itsme OAuth интеграция
- [ ] KBO/BCE проверка для business аккаунтов
- [ ] KYC level отображение

## TODO for developers

1. **Создать компонент VerificationBadge**
   - [ ] Отображение иконок для email/phone/itsme
   - [ ] Tooltip с пояснением
   - [ ] Стилизация (зеленый цвет для verified)

2. **Добавить badge на карточки объявлений**
   - [ ] В компоненте `AdvertCard.tsx`
   - [ ] Показывать только если продавец верифицирован
   - [ ] Небольшой badge в углу карточки

3. **Реализовать фильтр "Только верифицированные"**
   - [ ] Чекбокс в `SearchFilters.tsx`
   - [ ] Query фильтр: `verified_seller = true`
   - [ ] Обновление URL query params

4. **Itsme OAuth интеграция (Post-MVP)**
   - [ ] Настройка provider в Supabase
   - [ ] Endpoint `/api/auth/itsme/callback`
   - [ ] Обновление профиля после callback
   - [ ] UI кнопка "Sign in with Itsme"

5. **KBO/BCE проверка (Post-MVP)**
   - [ ] Поле `business_registration_number` в профиле
   - [ ] Endpoint `/api/profile/verify-business`
   - [ ] Интеграция с внешним API
   - [ ] Сохранение результата верификации
   - [ ] UI форма для ввода номера

6. **Улучшить UX верификации**
   - [ ] Пояснения зачем нужна верификация
   - [ ] Процесс верификации с шагами
   - [ ] Уведомления о статусе верификации

---

## 🔗 Related Docs

**Domains:** [phones.md](../domains/phones.md)
**Development:** [security-compliance.md](./security-compliance.md) • [deep-audit-20251108.md](./deep-audit-20251108.md) • [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md)
**Core:** [API_REFERENCE.md](../API_REFERENCE.md)




