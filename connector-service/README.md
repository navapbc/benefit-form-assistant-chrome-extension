# Connector service contract

The extension never connects directly to a provider and never accepts provider secrets. It talks to a Nava-controlled, organization-authenticated service using an opaque connection ID. Provider selection and source identifiers are metadata; OAuth grants, API keys, refresh tokens, and vendor sessions remain server-side.

Required read-only endpoints:

```text
GET /v1/connectors/{connectionId}/health
GET /v1/connectors/{connectionId}/schema?sourceId={sourceId}
GET /v1/connectors/{connectionId}/records/{recordId}?sourceId={sourceId}
```

For backward compatibility, the fictional Apricot adapter also accepts `formId`. Production adapters may translate the opaque `sourceId` into a provider object, form, dataset, TouchPoint, or resource key.

The service must:

- authenticate the signed-in organization and authorize access to the requested connection;
- keep provider credentials in a server-side secret manager;
- apply least-privilege, read-only provider scopes;
- return CORS headers for the managed extension ID and allow credentialed requests;
- return labeled schema fields before any record is mapped;
- never log participant values, tokens, or raw record bodies;
- provide audit events containing organization, user, connection, record ID, outcome, and timestamp—but no participant values;
- rate-limit lookups and return generic errors to the extension; and
- expose revocation and credential-rotation controls to organization administrators.

`mock-server.mjs` is a loopback-only implementation containing fictional record `339619`. It exists solely to exercise the extension contract and does not accept provider credentials.

Run it with:

```bash
npm run connector:mock
```

### Storage: memory or Neon Postgres

By default the mock keeps records in memory. When `DATABASE_URL` is set (`neon deploy` pulls it into the git-ignored `.env.local`, which `npm run connector:mock` loads), it uses Postgres instead. Set `MOCK_STORE=memory` to force memory. The extension never receives a database credential.

```bash
npm run connector:migrate   # applies schema.sql and seeds the preset scenarios (direct connection, idempotent)
npm run connector:mock      # logs which store it is using
```

Mock-only routes, loopback-only and fictional data only (the connector routes above stay read-only):

```text
GET  /v1/mock/datasets             list preset and custom scenario datasets
GET  /v1/mock/datasets/{id}        one dataset with its client-record payload
POST /v1/mock/datasets             save a custom dataset { id, label, scenario?, description?, payload }
PUT  /v1/mock/records/{recordId}   save a record { sourceId, attributes: { field_<n>: value } }
```

Writes must send `Content-Type: application/json`. A request with an `Origin` header (a browser page) is refused unless that exact origin is listed in `MOCK_WRITE_ORIGINS` (comma-separated); `Origin: null` is always refused. Requests with no `Origin`, such as curl or the tests, can write.

Preset datasets (`shared/mock-scenarios.mjs`) cannot be overwritten. To test against a database, set `MOCK_TEST_DATABASE_URL` when running `tests/mock-connector-store.test.cjs`.

Then configure the extension with:

```text
Organization: Riverside Community Services
Service URL: http://127.0.0.1:4789
Connection ID: nava-demo
Provider: Bonterra Apricot 360
Form / resource key: 99
```

The archived application used a Sidekick-hosted Apricot API proxy and server-side OAuth client credentials. A production Apricot adapter can reuse that service pattern, subject to current Bonterra/partner access, security review, organization authorization, and an explicit data-processing agreement. Other catalog providers require their own authorized adapters; see [`../docs/CONNECTOR_COVERAGE.md`](../docs/CONNECTOR_COVERAGE.md).
