# Restrict mock connector writes by origin and content type

## Summary
The mock connector's write routes now refuse browser origins that are not allow-listed, including `Origin: null`, and any body that is not declared JSON.

## Changes made
- `connector-service/mock-admin.mjs`: a write needs either no `Origin` header or an exact origin in `MOCK_WRITE_ORIGINS`, and a `Content-Type` of `application/json`.
- `connector-service/mock-server.mjs`: reads `MOCK_WRITE_ORIGINS` (empty by default) and passes it to the write handler.
- `tests/mock-connector-store.test.cjs`: a test for `null`, foreign and other-extension origins, bad content types, an allow-listed origin and a no-origin client. `connector-service/README.md` documents the variable.

## What it improves or fixes
Before: a sandboxed page could send `Origin: null`, or a plain-text form post, and write mock records to the local service. After: those requests get 403 or 415. Reads are unchanged. The data is fictional, so the impact was small.

## How to run / verify
```bash
node --test tests/mock-connector-store.test.cjs
```
