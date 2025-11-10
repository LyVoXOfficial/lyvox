# Настройка OAuth провайдеров в Supabase

Это руководство поможет настроить социальную авторизацию через Google, Facebook и другие провайдеры в Supabase.

## Общие шаги

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Authentication** → **Providers**
4. Выберите нужного провайдера из списка

---

## Google OAuth

### Шаг 1: Создание Google OAuth приложения

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Перейдите в **APIs & Services** → **Credentials**
4. Нажмите **Create Credentials** → **OAuth 2.0 Client ID**
5. Выберите **Application type**: `Web application`
6. Добавьте **Authorized JavaScript origins**:
   ```
   https://www.lyvox.be
   http://localhost:3000
   ```
7. Добавьте **Authorized redirect URIs**:
   ```
   https://kjzqowcxojspjtoadzee.supabase.co/auth/v1/callback
   http://localhost:54321/auth/v1/callback
   ```

### Шаг 2: Настройка в Supabase

1. Откройте **Authentication** → **Providers** → **Google**
2. Включите **Enable Sign in with Google**
3. Вставьте **Client ID** и **Client Secret** из Google Cloud Console
4. Убедитесь, что **Authorized Client IDs** содержит ваш Client ID
5. Нажмите **Save**

### Шаг 3: Настройка OAuth Consent Screen

1. В Google Cloud Console перейдите в **APIs & Services** → **OAuth consent screen**
2. Выберите **User Type**: `External`
3. Заполните необходимые поля:
   - **App name**: LyVoX
   - **User support email**: ваш email
   - **Developer contact information**: ваш email
4. Добавьте **Scopes**:
   - `openid`
   - `email`
   - `profile`
5. Добавьте **Test users** (для разработки)
6. Нажмите **Save and Continue**

### Публикация приложения (для production)

1. В **OAuth consent screen** нажмите **Publish App**
2. Подтвердите публикацию
3. Google может потребовать верификацию (если > 100 пользователей)

---

## Facebook OAuth

### Шаг 1: Создание Facebook приложения

1. Перейдите в [Facebook Developers](https://developers.facebook.com/)
2. Нажмите **My Apps** → **Create App**
3. Выберите **Consumer** (для обычных пользователей)
4. Заполните:
   - **App Display Name**: LyVoX
   - **App Contact Email**: ваш email
5. Нажмите **Create App**

### Шаг 2: Настройка Facebook Login

1. В дашборде приложения добавьте **Facebook Login** продукт
2. Перейдите в **Settings** → **Basic**
3. Скопируйте **App ID** и **App Secret**
4. Добавьте **App Domains**:
   ```
   lyvox.be
   localhost
   ```
5. В **Facebook Login Settings** добавьте **Valid OAuth Redirect URIs**:
   ```
   https://kjzqowcxojspjtoadzee.supabase.co/auth/v1/callback
   http://localhost:54321/auth/v1/callback
   ```

### Шаг 3: Настройка в Supabase

1. Откройте **Authentication** → **Providers** → **Facebook**
2. Включите **Enable Sign in with Facebook**
3. Вставьте **Facebook client ID** (App ID)
4. Вставьте **Facebook secret** (App Secret)
5. Нажмите **Save**

### Шаг 4: Перевод приложения в Production Mode

1. В Facebook App Dashboard перейдите в **Settings** → **Basic**
2. Убедитесь, что заполнены:
   - **Privacy Policy URL**: https://www.lyvox.be/legal/privacy
   - **Terms of Service URL**: https://www.lyvox.be/legal/terms
   - **User Data Deletion**: URL или инструкции
3. Переключите **App Mode** с `Development` на `Live`

---

## GitHub OAuth (опционально)

### Шаг 1: Создание GitHub OAuth App

1. Перейдите в [GitHub Settings](https://github.com/settings/developers)
2. Нажмите **OAuth Apps** → **New OAuth App**
3. Заполните:
   - **Application name**: LyVoX
   - **Homepage URL**: https://www.lyvox.be
   - **Authorization callback URL**: 
     ```
     https://kjzqowcxojspjtoadzee.supabase.co/auth/v1/callback
     ```
4. Нажмите **Register application**
5. Создайте **Client Secret**

### Шаг 2: Настройка в Supabase

1. Откройте **Authentication** → **Providers** → **GitHub**
2. Включите **Enable Sign in with GitHub**
3. Вставьте **Client ID** и **Client Secret**
4. Нажмите **Save**

---

## Тестирование OAuth

### Локальное тестирование

1. Убедитесь, что локальный Supabase запущен:
   ```bash
   npx supabase start
   ```

2. Проверьте `apps/web/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

3. Запустите приложение:
   ```bash
   npm run dev
   ```

4. Протестируйте вход через OAuth на http://localhost:3000/login

### Production тестирование

1. Задеплойте приложение на Vercel
2. Убедитесь, что environment variables настроены:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://kjzqowcxojspjtoadzee.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
   ```

3. Проверьте **Site URL** в Supabase Dashboard:
   - **Authentication** → **URL Configuration**
   - **Site URL**: `https://www.lyvox.be`
   - **Redirect URLs**: 
     ```
     https://www.lyvox.be/**
     http://localhost:3000/**
     ```

4. Протестируйте вход через OAuth на https://www.lyvox.be/login

---

## Troubleshooting

### Ошибка: "redirect_uri_mismatch"

**Причина**: Redirect URI не совпадает с настроенным в OAuth провайдере.

**Решение**:
1. Проверьте Redirect URI в Supabase Dashboard
2. Убедитесь, что URI добавлен в OAuth провайдере (Google/Facebook/GitHub)
3. URI должны совпадать **точно** (включая протокол, домен, порт, путь)

### Ошибка: "OAuth provider error"

**Причина**: Неверный Client ID или Secret.

**Решение**:
1. Перепроверьте Client ID и Secret в Supabase Dashboard
2. Убедитесь, что скопировали их без лишних пробелов
3. Проверьте, что приложение активно (не в Draft mode)

### Ошибка: "User cancelled the authentication"

**Причина**: Пользователь отменил авторизацию или закрыл окно.

**Решение**: Это нормальное поведение, не требует исправления.

### Facebook App в Development Mode

**Проблема**: Только администраторы и тестеры могут войти.

**Решение**:
1. Заполните все required fields (Privacy Policy, Terms, etc.)
2. Переключите App Mode на `Live`
3. Если требуется App Review - подайте на него

### Google OAuth не работает для новых пользователей

**Проблема**: Приложение не опубликовано (Internal mode).

**Решение**:
1. В Google Cloud Console опубликуйте OAuth Consent Screen
2. Убедитесь, что статус `Published` (не `Testing`)

---

## Безопасность

### Защита Client Secrets

- ❌ **НЕ КОММИТЬТЕ** Client Secrets в git
- ✅ Храните их в `.env.local` (игнорируется git)
- ✅ На production используйте Environment Variables в Vercel/Netlify

### Rate Limiting

- Настройте rate limiting в Supabase для предотвращения abuse
- **Authentication** → **Rate Limits**

### Email Verification

- Включите email verification для новых пользователей
- **Authentication** → **Email Templates**

---

## Checklist для production

- [ ] Google OAuth настроен и опубликован
- [ ] Facebook OAuth настроен и переведен в Live mode
- [ ] GitHub OAuth настроен (если используется)
- [ ] Redirect URIs правильно настроены для production URL
- [ ] Site URL в Supabase указывает на production domain
- [ ] Environment variables настроены в Vercel
- [ ] Email verification включена
- [ ] Privacy Policy и Terms of Service доступны на сайте
- [ ] Протестированы все OAuth провайдеры на production

---

## Полезные ссылки

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)

---

## Поддержка

Если возникли проблемы:
1. Проверьте логи в Supabase Dashboard → **Logs**
2. Проверьте Network tab в DevTools
3. Проверьте `apps/web/src/lib/errorLogger.ts` для client-side логов

