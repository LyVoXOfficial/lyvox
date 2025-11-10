# Включение WebAuthn MFA в Supabase

## Проблема
WebAuthn не отображается в Dashboard Multi-Factor настройках.

## Возможные причины

### 1. WebAuthn требует Pro план
Если SMS MFA требует "Upgrade to Pro", возможно WebAuthn тоже платная функция.

### 2. WebAuthn включается через Auth Hooks
В некоторых версиях Supabase WebAuthn настраивается через Auth Hooks (BETA).

### 3. WebAuthn скрыт или недоступен в UI

## Решения

### Решение 1: Проверить Auth Hooks
1. В левом меню перейдите: **Auth Hooks** (BETA)
2. Найдите настройки WebAuthn
3. Включите WebAuthn через хуки

### Решение 2: Использовать Supabase CLI
Если у вас есть доступ к Supabase CLI:

```bash
# Обновить настройки проекта
supabase link --project-ref kjzqowcxojspjtoadzee

# Применить конфигурацию
supabase db push
```

### Решение 3: Обратиться в поддержку Supabase
Если WebAuthn недоступен в вашем плане, обратитесь в поддержку:
- https://supabase.com/support
- Discord: https://discord.supabase.com

### Решение 4: Временное решение - использовать TOTP
Пока WebAuthn недоступен, можно использовать TOTP (уже включен):
- Google Authenticator
- Authy
- 1Password

## Проверка доступности WebAuthn

Проверьте в консоли браузера:

```javascript
// На странице https://www.lyvox.be/profile/test-auth
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: "webauthn",
  friendlyName: "Test"
});

console.log("Error:", error);
// Если error.code === 422 и message содержит "disabled"
// Значит WebAuthn отключен на уровне проекта
```

## Альтернативный подход

Если WebAuthn недоступен на Free плане:
1. Используйте TOTP (Google Authenticator) для MFA
2. Или обновитесь до Pro плана
3. Или реализуйте биометрию через сторонний сервис (Auth0, Clerk)

## Контакты поддержки Supabase

- Email: support@supabase.com
- Discord: https://discord.supabase.com
- GitHub Issues: https://github.com/supabase/supabase/issues

