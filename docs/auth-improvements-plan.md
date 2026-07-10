> [!WARNING]
> **Архивный план. Не выполнять и не обновлять статусы.** Актуальные auth-задачи и release-gates находятся только в [`docs/MASTER_PRODUCTION_TZ.md`](./MASTER_PRODUCTION_TZ.md). Файл сохранён как история.

# План улучшения авторизации

## Цели
1. Добавить больше методов входа (не только magic link)
2. Требовать верификацию email + phone для размещения объявлений

## Методы авторизации

### Текущие
- ✅ Email Magic Link (OTP)

### Добавить
- ⏳ Email + Password
- ⏳ Google OAuth
- ⏳ Facebook OAuth
- 💡 GitHub OAuth (опционально)
- 💡 Apple Sign In (опционально, для iOS)

## Требования для размещения объявлений

### Обязательная верификация
1. **Email подтвержден** (`verified_email = true`)
2. **Телефон подтвержден** (`verified_phone = true`)

### Процесс
1. Пользователь пытается создать объявление
2. Система проверяет статус верификации
3. Если не подтверждено:
   - Показать сообщение о необходимости верификации
   - Редирект на `/verify`
   - Предложить подтвердить email/телефон
4. После подтверждения - разрешить создание объявления

## Технические детали

### Страницы
- `/login` - вход (magic link, password, social)
- `/register` - регистрация (password, social)
- `/verify` - страница верификации email/phone

### Supabase Configuration

#### Email Provider
```toml
[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true
```

#### OAuth Providers (в Dashboard)
- Google: требуется Client ID и Secret
- Facebook: требуется App ID и Secret

#### Password Policy
- Минимум 8 символов
- Требовать спецсимволы (опционально)

### Database Changes

Таблица `profiles` уже имеет:
```sql
verified_email BOOLEAN DEFAULT false
verified_phone BOOLEAN DEFAULT false
```

### Middleware/Guards

Для `/post` маршрута:
```typescript
// Проверка верификации перед созданием объявления
const { verified_email, verified_phone } = profile;
if (!verified_email || !verified_phone) {
  redirect('/verify?reason=post_advert');
}
```

## Приоритеты

### Фаза 1 (Критично)
1. ✅ Email + Password login/register
2. ✅ Проверка верификации для /post
3. ✅ Страница /verify

### Фаза 2 (Важно)
1. ⏳ Google OAuth
2. ⏳ Facebook OAuth

### Фаза 3 (Желательно)
1. 💡 GitHub OAuth
2. 💡 Apple Sign In
3. 💡 Phone OTP verification

## UX Flow

### Новый пользователь
1. Регистрация (password или social)
2. Подтверждение email (автоматическое письмо)
3. Добавление телефона + подтверждение
4. Теперь может размещать объявления

### Существующий пользователь
1. Вход (любым методом)
2. Если не подтверждены email/phone:
   - При попытке создать объявление → редирект на /verify
   - Подтвердить недостающие данные
3. После верификации - доступ к размещению

## Security Considerations

1. **Rate Limiting**
   - Лимит на попытки входа
   - Лимит на отправку верификационных кодов

2. **Email Verification**
   - Токен истекает через 24 часа
   - Можно запросить повторно

3. **Phone Verification**
   - SMS код истекает через 10 минут
   - Максимум 3 попытки

4. **Password Requirements**
   - Минимум 8 символов
   - Не из списка распространенных паролей
   - Рекомендация использовать менеджер паролей

## Будущие улучшения

1. **2FA для всех методов**
   - TOTP для password-based
   - SMS для критичных операций

2. **Социальные профили**
   - Импорт аватара из социальных сетей
   - Показывать "Зарегистрирован через Google"

3. **Single Sign-On (SSO)**
   - Для корпоративных пользователей

## Миграция существующих пользователей

Пользователи с magic link:
- Могут продолжать использовать magic link
- Могут добавить пароль в настройках
- Могут привязать социальные аккаунты

## Тестирование

### Тест-кейсы
- [ ] Регистрация с паролем
- [ ] Вход с паролем
- [ ] Вход через Google
- [ ] Вход через Facebook
- [ ] Magic link (backward compatibility)
- [ ] Попытка создать объявление без верификации
- [ ] Верификация email
- [ ] Верификация телефона
- [ ] Все методы работают вместе

## Зависимости

- Supabase Auth (уже настроен)
- Twilio для SMS (уже настроен)
- Google OAuth credentials
- Facebook App credentials
