# Authentication Domain Documentation

## Overview

Система авторизации LyVoX поддерживает несколько методов входа:
- Email OTP (Magic Links)
- Биометрическая авторизация (WebAuthn/Passkeys)
- OAuth providers (планируется)

## Architecture

### Components

```
/app/login                          - Страница входа
/app/register                       - Страница регистрации
/app/auth/callback                  - OAuth callback handler
/app/auth/recovery                  - Восстановление доступа
/app/(protected)/profile/security   - Настройки безопасности

/components/BiometricLoginButton    - Кнопка входа через биометрию
/components/BiometricEnrollButton   - Кнопка регистрации биометрии
/components/BiometricSettings       - Управление биометрическими ключами

/lib/supabaseClient.ts              - Client-side Supabase клиент
/lib/supabaseServer.ts              - Server-side Supabase клиент
/lib/webauthn.ts                    - WebAuthn utilities
/hooks/useWebAuthn.ts               - React hook для WebAuthn
```

---

## Биометрическая авторизация

### Технологии

- **WebAuthn API** - стандарт W3C для web-аутентификации
- **Passkeys** - синхронизируемые credentials (iCloud Keychain, Google Password Manager)
- **Platform Authenticator** - Touch ID, Face ID, Windows Hello

### Требования

**Браузер:**
- Chrome 67+
- Firefox 60+
- Safari 13+
- Edge 18+

**Окружение:**
- HTTPS (обязательно в production)
- localhost (разрешен для разработки)

**Устройство:**
- Биометрический сенсор (Touch ID, Face ID, Windows Hello)
- Или аппаратный ключ безопасности (YubiKey, Titan)

### Процесс регистрации биометрии

#### 1. Пользователь должен быть залогинен

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  // Redirect to login
}
```

#### 2. Проверка поддержки WebAuthn

```typescript
import { isWebAuthnSupported, isPlatformAuthenticatorAvailable } from '@/lib/webauthn';

const supported = isWebAuthnSupported();
const platformAvailable = await isPlatformAuthenticatorAvailable();

if (!supported) {
  // Show error message
  return;
}
```

#### 3. Регистрация нового ключа

```typescript
import { enrollBiometric } from '@/lib/webauthn';

const deviceName = "MacBook Pro Touch ID"; // User-friendly name
const result = await enrollBiometric(deviceName);

if (result.success) {
  console.log("Factor ID:", result.factorId);
  // Show success message
} else {
  console.error("Error:", result.error);
  // Handle error
}
```

#### 4. Что происходит внутри

1. Вызов `supabase.auth.mfa.enroll({ factorType: 'webauthn', friendlyName })`
2. Supabase генерирует challenge
3. Браузер показывает биометрический промпт
4. Пользователь подтверждает (Touch ID, Face ID, и т.д.)
5. Браузер создает credential и отправляет в Supabase
6. Supabase сохраняет публичный ключ
7. Возвращается `factorId` для дальнейшего использования

### Процесс входа через биометрию

#### 1. Проверка наличия зарегистрированных ключей

```typescript
import { listCredentials } from '@/lib/webauthn';

const result = await listCredentials();

if (result.success && result.credentials.length > 0) {
  // Show biometric login button
} else {
  // Show only email login
}
```

#### 2. Вход через биометрию

```typescript
import { verifyBiometric } from '@/lib/webauthn';

const result = await verifyBiometric();

if (result.success) {
  // User is authenticated with AAL2
  router.push('/profile');
} else {
  // Show error and fallback to email
}
```

#### 3. Что происходит внутри

1. Получение списка зарегистрированных факторов
2. Выбор первого WebAuthn фактора
3. Вызов `supabase.auth.mfa.challenge({ factorId })`
4. Supabase генерирует challenge
5. Браузер показывает биометрический промпт
6. Пользователь подтверждает
7. Браузер подписывает challenge приватным ключом
8. Вызов `supabase.auth.mfa.verify({ factorId, challengeId })`
9. Supabase проверяет подпись публичным ключом
10. Возвращается сессия с AAL2 (повышенный уровень безопасности)

### Управление биометрическими ключами

#### Просмотр списка

```typescript
const result = await listCredentials();

if (result.success) {
  result.credentials.forEach(cred => {
    console.log(cred.friendlyName); // "MacBook Pro Touch ID"
    console.log(cred.createdAt);    // "2025-01-20T10:30:00Z"
    console.log(cred.lastUsedAt);   // "2025-01-21T15:45:00Z"
  });
}
```

#### Удаление ключа

```typescript
import { removeCredential } from '@/lib/webauthn';

const result = await removeCredential(factorId);

if (result.success) {
  // Key removed successfully
} else {
  // Error removing key
}
```

### UI Components

#### BiometricLoginButton

```tsx
import { BiometricLoginButton } from '@/components/BiometricLoginButton';

<BiometricLoginButton
  locale="ru"
  variant="default"
  size="lg"
  onSuccess={() => router.push('/profile')}
  onError={(error) => console.error(error)}
/>
```

#### BiometricEnrollButton

```tsx
import { BiometricEnrollButton } from '@/components/BiometricEnrollButton';

<BiometricEnrollButton
  locale="en"
  variant="outline"
  onSuccess={() => refreshCredentials()}
>
  Add Biometric Key
</BiometricEnrollButton>
```

#### BiometricSettings (полная страница настроек)

```tsx
import { BiometricSettings } from '@/components/BiometricSettings';

<BiometricSettings locale="ru" />
```

### Error Handling

```typescript
import { WebAuthnErrorType, formatErrorMessage } from '@/lib/webauthn';

const result = await enrollBiometric("My Device");

if (!result.success) {
  switch (result.error?.type) {
    case WebAuthnErrorType.NOT_SUPPORTED:
      // Browser doesn't support WebAuthn
      break;
    case WebAuthnErrorType.USER_CANCELLED:
      // User cancelled the prompt
      break;
    case WebAuthnErrorType.NOT_AUTHENTICATED:
      // User needs to login first
      break;
    case WebAuthnErrorType.INVALID_STATE:
      // Key already registered
      break;
    case WebAuthnErrorType.TIMEOUT:
      // Prompt timed out
      break;
    default:
      // Other errors
      break;
  }
  
  // Get localized error message
  const message = formatErrorMessage(result.error, 'ru');
  toast.error(message);
}
```

---

## Email OTP (Magic Links)

### Процесс входа

1. Пользователь вводит email на `/login`
2. Отправляется запрос на `supabase.auth.signInWithOtp()`
3. Supabase отправляет email с magic link
4. Пользователь кликает на ссылку
5. Браузер переходит на `/auth/callback?code=...`
6. Callback обменивает code на session через `exchangeCodeForSession()`
7. Пользователь перенаправляется на `/profile`

### Настройки Supabase

**Site URL:**
- Production: `https://www.lyvox.be`
- Development: `http://localhost:3000`

**Redirect URLs:**
```
https://www.lyvox.be/auth/callback
https://www.lyvox.be/**
http://localhost:3000/auth/callback
http://localhost:3000/**
```

**Email Template:**
```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">
  Войти в аккаунт
</a>
```

### Обработка ошибок

```typescript
// /app/auth/callback/route.ts

if (exchangeError.code === 'otp_expired') {
  // Link expired (1 hour)
  redirect('/login?error=expired&message=Ссылка истекла');
}

if (exchangeError.code === 'otp_disabled') {
  // Link already used
  redirect('/login?error=used&message=Ссылка уже использована');
}

if (exchangeError.code === 'bad_oauth_state') {
  // Invalid link format
  redirect('/login?error=invalid&message=Неверная ссылка');
}
```

---

## Session Management

### Client-side Session Handling

**Auto-refresh:**
- Токены обновляются автоматически за 5 минут до истечения
- Используется `autoRefreshToken: true` в Supabase клиенте
- Proactive scheduling через `setTimeout()`

**Persist Session:**
- Сохранение в `localStorage` с ключом `lyvox-auth-token`
- Автоматическое восстановление сессии при перезагрузке страницы

**Session Validation:**
```typescript
import { ensureValidSession } from '@/lib/supabaseClient';

// Before making important requests
const valid = await ensureValidSession();
if (!valid) {
  // Redirect to login
}
```

### Server-side Session Handling

**Helper Functions:**

```typescript
import { 
  getServerSession, 
  getServerUser, 
  isAuthenticated,
  requireAuth,
  isAdmin 
} from '@/lib/supabaseServer';

// In API route or Server Component
const session = await getServerSession(); // Returns session or null
const user = await getServerUser(); // Returns user or null
const isAuth = await isAuthenticated(); // Returns boolean

// Require authentication (throws if not authenticated)
try {
  const session = await requireAuth();
  // User is authenticated
} catch (error) {
  // Unauthorized
}

// Check admin status
const isUserAdmin = await isAdmin(userId);
```

**Auto-refresh on Server:**
- Проверка `expires_at` при каждом запросе
- Автоматический refresh если сессия истекла
- Обновление cookies с новыми токенами

### Security Settings

**Cookie Configuration:**
```typescript
{
  httpOnly: true,      // Защита от XSS
  secure: true,        // Только HTTPS (production)
  sameSite: 'lax',     // CSRF защита
  path: '/',           // Доступ на всем сайте
}
```

**Token Expiry:**
- Access token: 1 hour
- Refresh token: 30 days (или до явного logout)
- Remember device: 30 days extended session

---

## Security Features

### Multi-Factor Authentication (MFA)

**Authentication Assurance Levels (AAL):**
- **AAL1** - Single-factor (email OTP)
- **AAL2** - Multi-factor (email + biometric)

После биометрического входа сессия имеет уровень AAL2:
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session?.aal === 'aal2') {
  // High-security session
  // Can require AAL2 for sensitive operations
}
```

### Session Management

**Active Sessions:**
- Просмотр всех активных сессий на `/profile/security`
- Отображение информации об устройствах (OS, браузер, последняя активность)
- Завершение конкретной сессии
- Завершение всех сессий кроме текущей

**Revoke Sessions:**
```typescript
// Sign out from other devices
await supabase.auth.signOut({ scope: 'others' });

// Sign out from all devices (including current)
await supabase.auth.signOut({ scope: 'global' });

// Sign out from current device only
await supabase.auth.signOut(); // or { scope: 'local' }
```

### Account Recovery

**Password Reset:**
1. Пользователь заходит на `/auth/recovery`
2. Вводит email
3. Получает email с ссылкой для сброса
4. Переходит по ссылке на `/auth/reset-password`
5. Устанавливает новый пароль (если используется password auth)

**Lost Device:**
- Удаление биометрического ключа с любого устройства
- Завершение всех сессий кроме текущей
- Повторная регистрация биометрии на новом устройстве

---

## Testing

### Manual Testing Checklist

**Email OTP:**
- [ ] Email arrives within 1 minute
- [ ] Magic link works on first click
- [ ] Magic link expires after 1 hour
- [ ] Magic link cannot be reused
- [ ] Callback redirects to correct page
- [ ] Session persists after page reload

**Biometric:**
- [ ] Registration button appears only when supported
- [ ] Registration prompts for biometric
- [ ] Registration saves credential with friendly name
- [ ] Login button appears only when credential exists
- [ ] Login prompts for biometric
- [ ] Login creates session with AAL2
- [ ] Credential can be deleted
- [ ] Multiple credentials can be registered

**Session Management:**
- [ ] Session auto-refreshes before expiry
- [ ] Session persists in localStorage
- [ ] Session is cleared on logout
- [ ] Active sessions list displays correctly
- [ ] Other sessions can be terminated
- [ ] "Remember device" extends session

**Recovery:**
- [ ] Recovery email is sent
- [ ] Recovery link works
- [ ] Recovery link expires appropriately
- [ ] Old sessions are invalidated after recovery

### Automated Testing

```typescript
// Example test for biometric enrollment
import { enrollBiometric } from '@/lib/webauthn';

describe('WebAuthn Enrollment', () => {
  it('should enroll biometric credential', async () => {
    // Mock navigator.credentials.create
    global.navigator.credentials = {
      create: jest.fn().mockResolvedValue({
        id: 'credential-id',
        type: 'public-key',
      }),
    };

    const result = await enrollBiometric('Test Device');
    
    expect(result.success).toBe(true);
    expect(result.factorId).toBeDefined();
  });
});
```

### Browser Compatibility Testing

Test on:
- **Desktop:** Chrome, Firefox, Safari, Edge
- **Mobile:** iOS Safari, Chrome Android
- **OS:** macOS (Touch ID), Windows (Hello), Android (Fingerprint)

---

## Troubleshooting

### Common Issues

#### "exchange_failed" Error

**Причины:**
1. Redirect URL не добавлен в Supabase whitelist
2. Site URL не совпадает с текущим origin
3. Ссылка истекла (> 1 час)
4. Ссылка уже использована

**Решение:**
1. Проверить Supabase Dashboard > Authentication > URL Configuration
2. Убедиться что Site URL = `https://www.lyvox.be`
3. Добавить redirect URLs в whitelist
4. Запросить новую ссылку

#### Biometric Not Available

**Причины:**
1. Браузер не поддерживает WebAuthn
2. Используется HTTP вместо HTTPS
3. На устройстве нет биометрического сенсора
4. Пользователь не настроил биометрию в ОС

**Решение:**
1. Проверить `/debug/auth` для диагностики
2. Использовать HTTPS или localhost
3. Fallback на email OTP
4. Показать инструкции по настройке биометрии

#### Session Not Persisting

**Причины:**
1. Cookies заблокированы
2. localStorage недоступен
3. Private/Incognito режим
4. Third-party cookies блокированы

**Решение:**
1. Включить cookies в браузере
2. Выйти из private mode
3. Проверить browser settings

---

## Security Best Practices

1. ✅ **Always use HTTPS** в production
2. ✅ **Validate redirect URLs** на сервере
3. ✅ **Set secure cookie flags** (httpOnly, secure, sameSite)
4. ✅ **Implement rate limiting** для auth endpoints
5. ✅ **Log all auth events** для аудита
6. ✅ **Monitor failed attempts** для обнаружения атак
7. ✅ **Use CSRF tokens** где необходимо
8. ✅ **Rotate refresh tokens** регулярно
9. ✅ **Implement session timeout** (1 hour default)
10. ✅ **Provide account recovery** механизмы

---

## Roadmap

### Planned Features

- [ ] OAuth providers (Google, Facebook, Apple)
- [ ] SMS OTP для phone verification
- [ ] Two-factor authentication via TOTP (Google Authenticator)
- [ ] Hardware security keys (FIDO2)
- [ ] Passkey sync across devices
- [ ] Suspicious login detection
- [ ] IP-based security rules
- [ ] Device fingerprinting
- [ ] Login notifications via email/push

---

## API Reference

### Authentication Endpoints

**POST /api/auth/register**
- Create new user account
- Input: `{ email, password?, metadata? }`
- Output: `{ ok: true, user }`

**POST /api/auth/login**
- Send magic link
- Input: `{ email }`
- Output: `{ ok: true, message }`

**GET /auth/callback**
- Exchange code for session
- Query: `code=...&next=/profile`
- Redirect: `/profile` or `/login?error=...`

**POST /api/auth/webauthn/enroll**
- Register biometric key
- Input: `{ friendlyName }`
- Output: `{ ok: true, factorId }`

**POST /api/auth/webauthn/verify**
- Verify biometric
- Input: `{ factorId? }`
- Output: `{ ok: true, session }`

**GET /api/auth/webauthn/list**
- List registered keys
- Output: `{ ok: true, credentials: [...] }`

**DELETE /api/auth/webauthn/remove**
- Remove biometric key
- Input: `{ factorId }`
- Output: `{ ok: true }`

---

## Migration Guide

### From Email-only to Email + Biometric

1. Existing users can continue using email OTP
2. Add biometric enrollment prompt after first login
3. Incentivize biometric with "faster login" messaging
4. Allow users to manage biometric keys in settings
5. Keep email OTP as fallback method
6. No breaking changes - fully backward compatible

### From Password to OTP

If migrating from password-based auth:
1. Send notification email about change
2. Require email verification
3. Remove password fields
4. Update UI to use OTP flow
5. Migrate existing sessions gradually

---

## Support

For issues with authentication:
1. Check `/debug/auth` page for diagnostics
2. Review Supabase logs in Dashboard
3. Check browser console for errors
4. Verify environment variables
5. Test on different browsers/devices
6. Contact support with error logs

---

**Last Updated:** 2025-01-21
**Version:** 1.0.0
**Maintainer:** LyVoX Team

---

## 🔗 Related Docs

**Domains:** [devops.md](./devops.md)
**Development:** [Production master](../MASTER_PRODUCTION_TZ.md) • [deep-audit-20251108.md](../development/deep-audit-20251108.md)
**Catalog:** [CATALOG_MASTER.md](../catalog/CATALOG_MASTER.md)
**Core:** [API_REFERENCE.md](../API_REFERENCE.md)
