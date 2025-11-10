# Настройка Itsme OAuth в Supabase

## Обзор

Itsme - это бельгийский OAuth провайдер для верификации личности (KYC). После успешной аутентификации через Itsme, пользователь получает статус верификации и уровень KYC, который сохраняется в профиле.

## Предварительные требования

1. Аккаунт в Itsme Developer Portal
2. Зарегистрированное приложение в Itsme
3. Client ID и Client Secret от Itsme
4. Доступ к Supabase Dashboard

## Настройка в Supabase Dashboard

### 1. Добавить Itsme как OAuth провайдер

1. Откройте Supabase Dashboard → Authentication → Providers
2. Найдите "Itsme" в списке провайдеров (если его нет, используйте "Custom OAuth" или "OpenID Connect")
3. Включите провайдер

### 2. Настройка OAuth параметров

**Если Itsme поддерживается напрямую:**
- **Client ID**: Ваш Itsme Client ID
- **Client Secret**: Ваш Itsme Client Secret
- **Redirect URL**: `https://your-project.supabase.co/auth/v1/callback`

**Если используется Custom OAuth / OpenID Connect:**
- **Authorization URL**: `https://e2emerchant.itsme.be/oidc/authorize`
- **Token URL**: `https://e2emerchant.itsme.be/oidc/token`
- **User Info URL**: `https://e2emerchant.itsme.be/oidc/userinfo`
- **Client ID**: Ваш Itsme Client ID
- **Client Secret**: Ваш Itsme Client Secret
- **Scopes**: `openid profile email` (или требуемые Itsme scopes)

### 3. Настройка Redirect URLs

В Supabase Dashboard → Authentication → URL Configuration:
- Добавьте ваш production URL: `https://www.lyvox.be/auth/callback`
- Добавьте development URL: `http://localhost:3000/auth/callback`

### 4. Настройка в Itsme Developer Portal

В Itsme Developer Portal убедитесь, что:
- Redirect URI настроен на: `https://your-project.supabase.co/auth/v1/callback`
- Приложение имеет необходимые разрешения для KYC данных

## Настройка в коде

### Миграция базы данных

Миграция `20251110000000_itsme_fields.sql` уже создана и добавляет поля:
- `itsme_verified` (boolean) - статус верификации через Itsme
- `itsme_kyc_level` (text) - уровень KYC (basic, extended, full)

Примените миграцию:
```bash
supabase db push
```

### Callback Handler

Callback handler (`apps/web/src/app/auth/callback/route.ts`) уже обновлен для автоматического обновления профиля после успешной Itsme аутентификации.

### Добавление кнопки Itsme на страницы входа

Добавьте кнопку Itsme на страницы `/login` и `/register`:

```typescript
// В apps/web/src/app/login/page.tsx
const handleItsmeLogin = async () => {
  setLoading(true);
  try {
    const redirectUrl = new URL("/auth/callback", window.location.origin);
    const next = searchParams.get("next") ?? "/profile";
    redirectUrl.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "itsme", // или "custom" если используется Custom OAuth
      options: {
        redirectTo: redirectUrl.toString(),
      },
    });

    if (error) {
      toast.error("Ошибка входа через Itsme");
      logger.error("Itsme login failed", { error });
    }
  } catch (err) {
    logger.error("Itsme login exception", { error: err });
    toast.error("Не удалось подключиться к серверу");
  } finally {
    setLoading(false);
  }
};
```

## Проверка KYC уровня

После успешной аутентификации через Itsme, информация о KYC уровне сохраняется в профиле:

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("itsme_verified, itsme_kyc_level")
  .eq("id", userId)
  .single();

if (profile?.itsme_verified) {
  console.log("KYC Level:", profile.itsme_kyc_level);
  // "basic", "extended", "full"
}
```

## Уровни KYC

- **basic** - Базовая верификация (минимальные данные)
- **extended** - Расширенная верификация (дополнительные проверки)
- **full** - Полная верификация (максимальный уровень)

## Troubleshooting

### Проблема: Itsme не отображается в списке провайдеров

**Решение:**
- Используйте "Custom OAuth" или "OpenID Connect" провайдер
- Укажите endpoints Itsme вручную

### Проблема: Redirect URI mismatch

**Решение:**
- Убедитесь, что Redirect URI в Itsme совпадает с Supabase callback URL
- Формат: `https://your-project.supabase.co/auth/v1/callback`

### Проблема: KYC уровень не сохраняется

**Решение:**
- Проверьте, что Itsme возвращает `kyc_level` в user_metadata или app_metadata
- Проверьте логи callback handler для ошибок обновления профиля
- Убедитесь, что миграция применена

### Проблема: Ошибка "Provider not enabled"

**Решение:**
- Убедитесь, что провайдер включен в Supabase Dashboard
- Проверьте правильность Client ID и Secret

## Production Checklist

- [ ] Itsme приложение настроено в production окружении
- [ ] Client ID и Secret сохранены в Supabase environment variables
- [ ] Redirect URLs настроены для production домена
- [ ] Миграция применена в production базе данных
- [ ] Callback handler протестирован
- [ ] Кнопка Itsme добавлена на страницы входа/регистрации
- [ ] Логирование работает для отладки

## Связанные документы

- [Authentication Domain Documentation](./domains/auth.md)
- [Master Checklist - ITSME-001, ITSME-002](../development/MASTER_CHECKLIST.md)
- [Supabase OAuth Setup](./supabase-oauth-setup.md)

