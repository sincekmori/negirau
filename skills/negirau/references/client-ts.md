# negirau

Typed TypeScript client for the [Negirau](https://negirau.com) public API (read-only, anonymous, CORS-open).

Hand-written around resource namespaces, a typed error hierarchy, and retries with exponential backoff — dependency-free, and kept honest by contract tests: they load the service's build-time-generated `openapi.json` and prove that every operation is covered, that requests only use spec-declared parameters, and that spec-conformant payloads satisfy the exported types.
Drift between the API and this client fails CI — the same guarantee code generation gave, without generated code.

## Install

```
npm install negirau
```

## Usage

```ts
import { Negirau } from "negirau";

const client = new Negirau();

const found = await client.subjects.list({ q: "library", limit: 5 }); // free-text name search
for (const subject of found.subjects) {
  console.log(subject.id, subject.name);
}

const nearby = await client.subjects.listNear(35.64, 139.65, { radius: 3000 });

const reactions = await client.subjects.reactions.retrieve("0e6f9b3a-6b1e-4b8a-9a6a-1c2d3e4f5a6b");
console.log(reactions.total); // the all-time display value: exact up to 100, "100+" beyond
```

Errors and retries:

```ts
import { Negirau, NotFoundError } from "negirau";

const client = new Negirau({ maxRetries: 2 }); // 408/409/429/5xx retry with exponential backoff

try {
  await client.subjects.retrieve("no-such-subject");
} catch (error) {
  if (error instanceof NotFoundError) {
    console.error(error.statusCode, error.code); // 404 not_found
  }
}
```

## Notes

- Counts are display values by design: exact up to 100, `"100+"` beyond, and never rankings — no API returns unbounded exact numbers.
- There are no bulk dumps: resolve names with `client.subjects.list({ q })` (server-side trigram search, Japanese and English substrings).

## License

Apache-2.0.
