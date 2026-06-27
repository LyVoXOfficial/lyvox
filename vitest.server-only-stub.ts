// No-op stub for the "server-only" package in Vitest.
// The real package throws at import time to prevent server-only modules from
// being bundled into the client. In tests there is no client bundle, so the
// guard is unnecessary. This stub makes the import a no-op.
export {};
