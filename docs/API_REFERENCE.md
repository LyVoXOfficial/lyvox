# LyVoX API Reference

This reference covers every API Route under `apps/web/src/app/api`. All JSON responses are UTF-8 encoded. Authenticated requests must include the Supabase session cookies (`sb:token`, `sb:refreshToken`) issued by Supabase Auth.

> **Admin note:** Admin-only endpoints require a Supabase session whose JWT exposes `app_metadata.role = 'admin'`. Next.js handlers verify this claim before running service-role database calls.

## GET /api/me

- **Purpose:** Return the current Supabase session plus profile, consent, and phone verification state.
- **Authentication:** Supabase session cookie (optional). Unauthenticated users receive all fields set to `null`/`false`.
- **Request body:** Not used.
- **Response schema:**

```json
{
  "type": "object",
  "properties": {
    "user": {
      "anyOf": [
        { "type": "object" },
        { "type": "null" }
      ]
    },
    "profile": {
      "anyOf": [
        { "type": "object" },
        { "type": "null" }
      ]
    },
    "phone": {
      "anyOf": [
        { "type": "object" },
        { "type": "null" }
      ]
    },
    "verifiedPhone": { "type": "boolean" },
    "verifiedEmail": { "type": "boolean" },
    "consents": {
      "anyOf": [
        { "type": "object" },
        { "type": "null" }
      ]
    }
  },
  "required": [
    "user",
    "profile",
    "phone",
    "verifiedPhone",
    "verifiedEmail",
    "consents"
  ],
  "additionalProperties": false
}
```

- **Notes:** `consents` returns the latest snapshot saved in `profiles.consents` (`terms`, `privacy`, `marketing` objects with `accepted`, `accepted_at`, `version`).
- **Errors:** None (always 200).
- **curl:**

```bash
curl -X GET https://localhost:3000/api/me \
  --cookie "sb:token=YOUR_ACCESS_TOKEN; sb:refreshToken=YOUR_REFRESH_TOKEN"
```

## POST /api/auth/signout

- **Purpose:** Terminate the current Supabase session.
- **Authentication:** Supabase session cookie required.
- **Request schema:** _No body._
- **Response schema:**

```json
{
  "type": "object",
  "properties": {
    "ok": { "const": true }
  },
  "required": ["ok"],
  "additionalProperties": false
}
```

- **Error codes:** None (always 200; Supabase errors surface via server logs).
- **curl:**

```bash
curl -X POST https://localhost:3000/api/auth/signout \
  --cookie "sb:token=YOUR_ACCESS_TOKEN" \
  -H "Content-Length: 0"
```

## POST /api/auth/register

- **Purpose:** Register a new user, persist profile consent metadata, and trigger Supabase email verification.
- **Authentication:** Public (no session required).
- **Rate limits:** Not enforced at the API layer; rely on Supabase abuse controls.
- **Request schema:**

```json
{
  "type": "object",
  "properties": {
    "email": { "type": "string", "format": "email" },
    "password": { "type": "string", "minLength": 8 },
    "confirmPassword": { "type": "string", "minLength": 8 },
    "consents": {
      "type": "object",
      "properties": {
        "terms": { "type": "boolean" },
        "privacy": { "type": "boolean" },
        "marketing": { "type": "boolean" }
      },
      "required": ["terms", "privacy"],
      "additionalProperties": false
    },
    "locale": { "type": "string", "enum": ["en", "fr", "nl", "ru"], "default": "en" }
  },
  "required": ["email", "password", "confirmPassword", "consents"],
  "additionalProperties": false
}
```

- **Response schema:**

```json
{
  "type": "object",
  "properties": {
    "ok": { "const": true },
    "verificationRequired": { "type": "boolean" }
  },
  "required": ["ok", "verificationRequired"],
  "additionalProperties": false
}
```

- **Error codes:**
  - `400 INVALID_JSON` – request body is not valid JSON.
  - `400 INVALID_EMAIL` – email fails validation.
  - `400 WEAK_PASSWORD` – password does not satisfy complexity rules.
  - `400 PASSWORD_MISMATCH` – confirmation does not match password.
  - `400 CONSENT_REQUIRED` – mandatory GDPR consents not accepted.
  - `400 SIGNUP_FAILED` – Supabase returned an unexpected error (see `detail`).
  - `409 EMAIL_IN_USE` – Supabase reports an existing user for the email.
  - `500 SERVICE_ROLE_MISSING` – service-role key not configured on the backend.
  - `500 PROFILE_UPSERT_FAILED` – unable to persist the initial `profiles` record.
  - `500 SIGNUP_INCOMPLETE` – Supabase did not return a user identifier.

- **curl:**

```bash
curl -X POST https://localhost:3000/api/auth/register   -H "Content-Type: application/json"   -d '{
    "email": "founder@example.com",
    "password": "SecureP@ssw0rd",
    "confirmPassword": "SecureP@ssw0rd",
    "consents": { "terms": true, "privacy": true, "marketing": false },
    "locale": "en"
  }'
```



## POST /api/profile/update

- **Purpose:** Upsert the authenticated user's profile display name.
- **Authentication:** Supabase session cookie required.
- **Request schema:**

```json
{
  "type": "object",
  "properties": {
    "display_name": { "type": "string", "maxLength": 80 }
  },
  "required": ["display_name"],
  "additionalProperties": false
}
```

- **Response schema (success):**

```json
{
  "type": "object",
  "properties": {
    "ok": { "const": true }
  },
  "required": ["ok"],
  "additionalProperties": false
}
```

- **Error codes:**
  - `401 UNAUTH`: `{ "ok": false, "error": "UNAUTH" }`
  - `400 BAD REQUEST`: `{ "ok": false, "error": "<supabase_error_message>" }`

- **curl:**

```bash
curl -X POST https://localhost:3000/api/profile/update \
  --cookie "sb:token=YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"display_name":"Jane Seller"}'
```

## POST /api/profile/consents

- **Purpose:** Update the marketing consent snapshot for the authenticated profile and record an audit log.
- **Authentication:** Supabase session cookie required.
- **Request schema:**

```json
{
  "type": "object",
  "properties": {
    "marketingOptIn": { "type": "boolean" }
  },
  "required": ["marketingOptIn"],
  "additionalProperties": false
}
```

- **Response schema (success):**

```json
{
  "type": "object",
  "properties": {
    "ok": { "const": true },
    "consents": { "type": "object" }
  },
  "required": ["ok", "consents"],
  "additionalProperties": false
}
```

- **Error codes:**
  - `400 INVALID_JSON`/`INVALID_PAYLOAD`
  - `401 UNAUTH`
  - `500 SERVICE_ROLE_MISSING`/`PROFILE_LOOKUP_FAILED`/`CONSENT_UPDATE_FAILED`/`CONSENT_LOG_FAILED`

- **curl:**

```bash
curl -X POST https://localhost:3000/api/profile/consents \
  --cookie "sb:token=YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"marketingOptIn":true}'
```

## GET /api/profile/consents

- **Purpose:** Export the latest consent snapshot plus audit history of consent events.
- **Authentication:** Supabase session cookie required.
- **Query params:** `format=download` (optional) to force `Content-Disposition: attachment`.
- **Response schema (200):**

```json
{
  "type": "object",
  "properties": {
    "generatedAt": { "type": "string", "format": "date-time" },
    "consents": { "type": ["object", "null"] },
    "history": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "action": { "type": "string" },
          "details": { "type": ["object", "null"] },
          "created_at": { "type": ["string", "null"], "format": "date-time" }
        },
        "required": ["id", "action", "details", "created_at"],
        "additionalProperties": false
      }
    }
  },
  "required": ["generatedAt", "consents", "history"],
  "additionalProperties": false
}
```

- **Error codes:**
  - `401 UNAUTH`
  - `500 SERVICE_ROLE_MISSING`/`PROFILE_LOOKUP_FAILED`/`CONSENT_LOG_FETCH_FAILED`

- **curl:**

```bash
curl -X GET "https://localhost:3000/api/profile/consents?format=download" \
  --cookie "sb:token=YOUR_ACCESS_TOKEN" \
  -H "Accept: application/json" \
  -o consents.json
```

## GET /api/profile/get

- **Purpose:** Retrieve the authenticated user's profile summary.
- **Authentication:** Supabase session cookie (optional). Unauthenticated requests return `{}`.
- **Request body:** _No body._
- **Response schema (200):**

```json
{
  "type": "object",
  "properties": {
    "display_name": { "type": ["string", "null"] },
    "phone": { "type": ["string", "null"] },
    "verified_email": { "type": ["boolean", "null"] },
    "verified_phone": { "type": ["boolean", "null"] },
    "created_at": { "type": ["string", "null"], "format": "date-time" }
  },
  "additionalProperties": false
}
```

- **Error codes:** `400 BAD REQUEST` for Supabase errors: `{ "error": "<message>" }`.
- **curl:**

```bash
curl -X GET https://localhost:3000/api/profile/get \
  --cookie "sb:token=YOUR_ACCESS_TOKEN"
```

## POST /api/phone/request

- **Purpose:** Start phone verification. Validates E.164 format, stores number, generates OTP, sends SMS via Twilio.
- **Authentication:** Supabase session cookie required.
- **Request schema:**

```json
{
  "type": "object",
  "properties": {
    "phone": {
      "type": "string",
      "pattern": "^\\+\\d{8,15}$"
    }
  },
  "required": ["phone"],
  "additionalProperties": false
}
```

- **Response schema (success):** `{ "type": "object", "properties": { "ok": { "const": true } }, "required": ["ok"], "additionalProperties": false }`
- **Rate limits:** 5 requests / 15 minutes per user (`otp:user:<uid>`), fallback 5 / 15 minutes per IP, plus 20 / 60 minutes per IP (`otp:ip:<ip>`).
- **Error codes:**
  - `400 INVALID_FORMAT`: `{ "ok": false, "error": "INVALID_FORMAT" }`
  - `401 UNAUTH`: `{ "ok": false, "error": "UNAUTH" }`
- `429 rate_limited`: `{ "error": "rate_limited", "retry_after_seconds": <seconds>, "limit": <n>, "remaining": 0, "resetAt": "<iso>" }` with headers `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
  - `500 SMS_SEND_FAIL`: Twilio failure `{ "ok": false, "error": "SMS_SEND_FAIL" }`
  - `500 INTERNAL_ERROR`: unexpected issue `{ "ok": false, "error": "INTERNAL_ERROR", "detail": "..." }`

- **curl:**

```bash
curl -X POST https://localhost:3000/api/phone/request \
  --cookie "sb:token=YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+32470000000"}'
```

## POST /api/phone/verify

- **Purpose:** Verify the OTP delivered to the user.
- **Authentication:** Supabase session cookie required.
- **Request schema:**

```json
{
  "type": "object",
  "properties": {
    "phone": {
      "type": "string",
      "pattern": "^\\+\\d{8,15}$"
    },
    "code": {
      "type": "string",
      "minLength": 4,
      "maxLength": 6
    }
  },
  "required": ["phone", "code"],
  "additionalProperties": false
}
```

- **Response schema:** `{ "type": "object", "properties": { "ok": { "const": true } }, "required": ["ok"], "additionalProperties": false }`
- **Error codes:**
  - `401 UNAUTH`: `{ "ok": false, "error": "UNAUTH" }`
  - `400 OTP_NOT_FOUND`: `{ "ok": false, "error": "OTP_NOT_FOUND" }`
  - `400 OTP_EXPIRED`: `{ "ok": false, "error": "OTP_EXPIRED" }`
  - `400 OTP_INVALID`: `{ "ok": false, "error": "OTP_INVALID" }`
  - `429 OTP_LOCKED`: `{ "ok": false, "error": "OTP_LOCKED" }`
  - `500 INTERNAL_ERROR`: `{ "ok": false, "error": "INTERNAL_ERROR", "detail": "..." }`

- **curl:**

```bash
curl -X POST https://localhost:3000/api/phone/verify \
  --cookie "sb:token=YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+32470000000","code":"123456"}'
```

## POST /api/adverts

- **Purpose:** Create a new draft advert for the authenticated user with default values.
- **Authentication:** Supabase session cookie required.
- **Request body:** _No body._
- **Response schema (success):**
```json
{
  "type": "object",
  "properties": {
    "ok": { "const": true },
    "advert": {
      "type": "object",
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "status": { "type": "string", "const": "draft" },
        "category_id": { "type": "string", "format": "uuid" }
      },
      "required": ["id", "status", "category_id"]
    }
  },
  "required": ["ok", "advert"]
}
```
- **Error codes:**
  - `401 UNAUTHENTICATED` – The user is not authenticated.
  - `400 <db_error>` or `400 CREATE_FAILED` – The database operation failed.
- **curl:**
```bash
curl -X POST https://localhost:3000/api/adverts \
  --cookie "sb:token=YOUR_ACCESS_TOKEN" \
  -H "Content-Length: 0"
```

## PATCH /api/adverts/:id

- **Purpose:** Update an existing advert. The caller must be the owner.
- **Authentication:** Supabase session cookie required.
- **Path params:** `id` (UUID string).
- **Request schema:**
```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string", "minLength": 3 },
    "description": { "type": "string", "minLength": 10 },
    "price": { "type": ["number", "null"], "minimum": 0 },
    "location": { "type": "string" },
    "category_id": { "type": "string", "format": "uuid" },
    "condition": { "type": "string", "enum": ["new", "used", "for_parts"] },
    "currency": { "type": "string", "enum": ["EUR", "USD", "GBP", "RUB"] },
    "status": { "type": "string", "enum": ["draft", "active", "archived"] },
    "specifics": {
      "type": "object",
      "description": "Vehicle-specific attributes stored as key-value pairs (strings). Includes make_id, model_id, year, steering_wheel, body_type, doors, color_id, color_code, power, engine_type, engine_volume, transmission, drive, mileage, vehicle_condition, customs_cleared, under_warranty, owners_count, vin, additional_phone, and option_* keys for selected vehicle options.",
      "additionalProperties": { "type": "string" }
    }
  },
  "additionalProperties": false
}
```
- **Response schema (success):**
```json
{
  "type": "object",
  "properties": {
    "ok": { "const": true },
    "advert": {
      "type": "object",
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "status": { "type": "string" },
        "category_id": { "type": "string", "format": "uuid" },
        "condition": { "type": ["string", "null"] }
      },
      "required": ["id", "status", "category_id", "condition"]
    }
  },
  "required": ["ok", "advert"]
}
```
- **Error codes:**
  - `400 MISSING_ID` – The advert ID is missing from the URL path.
  - `400 INVALID_PAYLOAD` – The request body is not valid JSON.
  - `400 invalid_vehicle_data` – The vehicle data is invalid (see `details` for specifics).
  - `400 invalid_status` – The requested status is not a valid value.
  - `400 invalid_transition` – The requested status transition is not allowed (e.g., from `active` to `draft`).
  - `400 media_required` – The advert must have at least one image to be published.
  - `400 media_check_failed` – An error occurred while checking for media.
  - `400 update_failed` – The database update operation failed.
  - `400 fetch_failed` – Failed to fetch the existing advert record.
  - `401 UNAUTHENTICATED` – The user is not authenticated.
  - `403 FORBIDDEN` – The user does not own this advert.
  - `403 forbidden_status` – The requested status is not allowed (e.g., `blocked`).
  - `404 NOT_FOUND` – The advert with the specified ID was not found.
- **curl:**
```bash
curl -X PATCH https://localhost:3000/api/adverts/00000000-0000-0000-0000-000000000000 \
  --cookie "sb:token=YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title", "status":"active"}'
```

## DELETE /api/adverts/:id

- **Purpose:** Delete an advert owned by the caller, cascading media and item specifics.
- **Authentication:** Supabase session cookie required.
- **Path params:** `id` (UUID string).
- **Request body:** _No body._
- **Response schema:** `{ "type": "object", "properties": { "ok": { "const": true } }, "required": ["ok"], "additionalProperties": false }`
- **Error codes:**
  - `400 MISSING_ID`: `{ "ok": false, "error": "MISSING_ID" }`
  - `401 UNAUTHENTICATED`: `{ "ok": false, "error": "UNAUTHENTICATED" }`
  - `403 FORBIDDEN`: `{ "ok": false, "error": "FORBIDDEN" }` (caller does not own the advert).
  - `404 NOT_FOUND`: `{ "ok": false, "error": "NOT_FOUND" }`
  - `400 <db_error>`: `{ "ok": false, "error": "<message>" }` (ad_item_specifics/media delete failure).

- **curl:**

```bash
curl -X DELETE https://localhost:3000/api/adverts/00000000-0000-0000-0000-000000000000 \
  --cookie "sb:token=YOUR_ACCESS_TOKEN"
```

## POST /api/reports/create

- **Purpose:** File a moderation report against an advert.
- **Authentication:** Supabase session cookie required.
- **Request schema:**

```json
{
  "type": "object",
  "properties": {
    "advert_id": { "type": "string", "format": "uuid" },
    "reason": {
      "type": "string",
      "enum": ["fraud", "spam", "duplicate", "nsfw", "other"]
    },
    "details": { "type": ["string", "null"], "maxLength": 2000 }
  },
  "required": ["advert_id", "reason"],
  "additionalProperties": false
}
```

- **Response schema:** `{ "type": "object", "properties": { "ok": { "const": true } }, "required": ["ok"], "additionalProperties": false }`
- **Rate limits:** 5 submissions / 10 minutes per user (`report:user:<uid>`), 50 submissions / 24 hours per IP (`report:ip:<ip>`).
- **Error codes:**
  - `401 UNAUTH`: `{ "ok": false, "error": "UNAUTH" }`
  - `400 BAD_INPUT`: `{ "ok": false, "error": "BAD_INPUT" }`
  - `409 ALREADY_REPORTED`: `{ "ok": false, "error": "ALREADY_REPORTED" }`
- `429 rate_limited`: `{ "error": "rate_limited", "retry_after_seconds": <seconds>, "limit": <n>, "remaining": 0, "resetAt": "<iso>" }` with headers `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
  - `400 <db_error>`: `{ "ok": false, "error": "<message>" }`

- **curl:**

```bash
curl -X POST https://localhost:3000/api/reports/create \
  --cookie "sb:token=YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"advert_id":"00000000-0000-0000-0000-000000000000","reason":"fraud","details":"Suspicious pricing."}'
```

## GET /api/reports/list

- **Purpose:** List reports for moderation filtered by status.
- **Authentication:** Supabase session cookie with `app_metadata.role = 'admin'`. Requests without the admin claim return `403 FORBIDDEN`.
- **Query params:** `status=pending|accepted|rejected` (defaults to `pending`).
- **Response schema:**

```json
{
  "type": "object",
  "properties": {
    "ok": { "const": true },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "reason": { "type": "string" },
          "details": { "type": ["string", "null"] },
          "status": { "type": "string" },
          "created_at": { "type": "string", "format": "date-time" },
          "updated_at": { "type": ["string", "null"], "format": "date-time" },
          "advert_id": { "type": "string", "format": "uuid" },
          "reporter": { "type": "string", "format": "uuid" },
          "reviewed_by": { "type": ["string", "null"], "format": "uuid" },
          "adverts": {
            "type": ["object", "null"],
            "properties": {
              "id": { "type": "string", "format": "uuid" },
              "title": { "type": ["string", "null"] },
              "user_id": { "type": ["string", "null"], "format": "uuid" }
            },
            "additionalProperties": false
          }
        },
        "additionalProperties": false
      }
    }
  },
  "required": ["ok", "items"],
  "additionalProperties": false
}
```

- **Rate limits:** 60 requests / minute per admin (`report:admin:<uid>`).
- **Error codes:**
  - `403 FORBIDDEN`: `{ "ok": false, "error": "FORBIDDEN" }`
  - `500 SERVICE_ROLE_REQUIRED`: `{ "ok": false, "error": "SUPABASE_SERVICE_ROLE_KEY is not configured..." }`
- `429 rate_limited`: `{ "error": "rate_limited", "retry_after_seconds": <seconds>, "limit": <n>, "remaining": 0, "resetAt": "<iso>" }` with headers `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
  - `400 <db_error>`: `{ "ok": false, "error": "<message>" }`

- **curl:**

```bash
curl -X GET "https://localhost:3000/api/reports/list?status=pending" \
  --cookie "sb:token=ADMIN_ACCESS_TOKEN" # run from backend context where SUPABASE_SERVICE_ROLE_KEY is configured
```

## POST /api/reports/update

- **Purpose:** Update moderation status, optionally unpublish the advert, and adjust trust.
- **Authentication:** Supabase session cookie with `app_metadata.role = 'admin'`; handler escalates to the service role internally for writes.
- **Request schema:**

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "new_status": {
      "type": "string",
      "enum": ["accepted", "rejected"]
    },
    "unpublish": { "type": "boolean" }
  },
  "required": ["id", "new_status"],
  "additionalProperties": false
}
```

- **Response schema:** `{ "type": "object", "properties": { "ok": { "const": true } }, "required": ["ok"], "additionalProperties": false }`
- **Rate limits:** 60 updates / minute per admin (`report:admin:<uid>`).
- **Error codes:**
  - `403 FORBIDDEN`: `{ "ok": false, "error": "FORBIDDEN" }`
  - `400 BAD_INPUT`: `{ "ok": false, "error": "BAD_INPUT" }`
  - `500 SERVICE_ROLE_REQUIRED`: `{ "ok": false, "error": "SUPABASE_SERVICE_ROLE_KEY is not configured..." }`
  - `404 NOT_FOUND`: `{ "ok": false, "error": "NOT_FOUND" }`
  - `400 UPDATE_FAILED`: `{ "ok": false, "error": "<message>" }`
- `429 rate_limited`: `{ "error": "rate_limited", "retry_after_seconds": <seconds>, "limit": <n>, "remaining": 0, "resetAt": "<iso>" }` with headers `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

- **curl (server-side execution)**:

```bash
curl -X POST https://localhost:3000/api/reports/update \
  --cookie "sb:token=ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":123,"new_status":"accepted","unpublish":true}'
```

## GET /api/reports/list (server failure example)

If `SUPABASE_SERVICE_ROLE_KEY` is absent, the endpoint returns:

```json
{
  "ok": false,
  "error": "SUPABASE_SERVICE_ROLE_KEY is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server to view complaints."
}
```

---

_All endpoints declare `export const runtime = "nodejs";` to ensure compatibility with Supabase libraries and Upstash clients._

---

## 🔗 Related Docs

**Domains:** [adverts.md](./domains/adverts.md)
**Development:** [security-compliance.md](./development/security-compliance.md) • [deep-audit-20251108.md](./development/deep-audit-20251108.md) • [MASTER_CHECKLIST.md](./development/MASTER_CHECKLIST.md)
**Catalog:** [CATALOG_MASTER.md](./catalog/CATALOG_MASTER.md)
