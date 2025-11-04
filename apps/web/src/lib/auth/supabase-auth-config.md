# Supabase Auth Configuration Guide

## Required Settings in Supabase Dashboard

### 1. Site URL Configuration

**Path:** Authentication > URL Configuration > Site URL

**Production:**
```
https://www.lyvox.be
```

**Development:**
```
http://localhost:3000
```

### 2. Redirect URLs

**Path:** Authentication > URL Configuration > Redirect URLs

Add the following URLs:

**Production:**
```
https://www.lyvox.be/auth/callback
https://lyvox.be/auth/callback
https://www.lyvox.be/**
https://lyvox.be/**
```

**Development:**
```
http://localhost:3000/auth/callback
http://localhost:3000/**
```

### 3. Email Templates

**Path:** Authentication > Email Templates > Magic Link

**Subject:** Войдите в ваш аккаунт LyVoX

**Body:**
```html
<h2>Войдите в ваш аккаунт</h2>
<p>Нажмите на ссылку ниже для входа:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Войти в аккаунт</a></p>
<p>Или скопируйте и вставьте этот URL в браузер:</p>
<p>{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email</p>
<p>Эта ссылка действительна в течение 1 часа.</p>
```

### 4. Auth Providers

**Path:** Authentication > Providers

**Email Provider:**
- ✅ Enable Email provider
- ✅ Confirm email: OFF (for faster development, enable for production)
- ✅ Secure email change: ON
- ✅ Double confirm email changes: OFF

### 5. Auth Settings

**Path:** Authentication > Settings

**Session Settings:**
- JWT expiry: 3600 seconds (1 hour)
- Refresh token rotation: ON
- Reuse interval: 10 seconds
- Minimum password length: 8

**Security:**
- Enable CAPTCHA: OFF (can enable for production)
- Rate limiting: ON

### 6. WebAuthn (Biometric) Settings

**Path:** Authentication > Providers > Phone

Enable WebAuthn/Passkeys:
```toml
[auth.mfa]
  [auth.mfa.web_authn]
    enroll_enabled = true
    verify_enabled = true
```

## Environment Variables

Ensure these are set in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Troubleshooting

### "exchange_failed" Error

**Possible causes:**
1. Redirect URL not whitelisted in Supabase
2. Site URL mismatch
3. Token expired (> 1 hour)
4. Token already used
5. Invalid token format

**Solutions:**
1. Check Supabase Dashboard > Authentication > URL Configuration
2. Ensure Site URL matches your domain
3. Request a new magic link
4. Check browser console for detailed error
5. Check Supabase logs in Dashboard

### Biometric Not Available

**Requirements:**
1. HTTPS (or localhost)
2. Browser support for WebAuthn
3. Device has biometric sensor (Touch ID, Face ID, Windows Hello)
4. User must be logged in to register biometric key

**Supported Browsers:**
- Chrome 67+
- Firefox 60+
- Safari 13+
- Edge 18+

### Session Not Persisting

**Check:**
1. Cookies are enabled
2. Third-party cookies not blocked
3. Browser not in private/incognito mode
4. localStorage is accessible

## Testing Checklist

- [ ] Magic link email arrives within 1 minute
- [ ] Magic link redirects to /auth/callback
- [ ] Callback successfully exchanges code for session
- [ ] User redirected to /profile after login
- [ ] Session persists after page refresh
- [ ] Biometric registration works (if supported)
- [ ] Biometric login works (if registered)
- [ ] Logout works correctly
- [ ] Session expires after 1 hour
- [ ] Refresh token updates session

## Common Issues

### Issue: "Invalid redirect URL"

**Solution:**
Add your domain to Redirect URLs in Supabase Dashboard

### Issue: "Email link is invalid"

**Solution:**
1. Check email template uses correct callback URL
2. Ensure `?token_hash=` and `?type=email` parameters are present
3. Use PKCE flow for better security

### Issue: Biometric prompt doesn't appear

**Solution:**
1. Check browser console for errors
2. Verify HTTPS is being used
3. Ensure user is logged in first
4. Check if device has biometric sensor

## Security Best Practices

1. ✅ Always use HTTPS in production
2. ✅ Enable email confirmation in production
3. ✅ Enable rate limiting
4. ✅ Use secure cookies (httpOnly, sameSite)
5. ✅ Implement CSRF protection
6. ✅ Log all auth events
7. ✅ Monitor failed login attempts
8. ✅ Rotate refresh tokens
9. ✅ Set appropriate token expiry times
10. ✅ Use Content Security Policy headers

