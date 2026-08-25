# negirau

[![PyPI version](https://img.shields.io/pypi/v/negirau)](https://pypi.org/project/negirau/)

Python client for the [Negirau](https://negirau.com) public API (read-only, anonymous).

Hand-written around resource namespaces, a `types` package, a typed exception hierarchy, and retries with exponential backoff — and kept honest by contract tests: they load the service's build-time-generated `openapi.json` and prove that every operation is covered, that requests only use spec-declared parameters, and that spec-conformant payloads parse into the models.
Drift between the API and this client fails CI — the same guarantee code generation gave, without generated code.

## Install

```
pip install negirau
```

## Usage

```python
from negirau import Negirau

client = Negirau()

found = client.subjects.list(q="消防", limit=5)  # free-text name search
for subject in found.subjects:
    print(subject.id, subject.name)

nearby = client.subjects.list_near(35.64, 139.65, radius=3000)

reactions = client.subjects.reactions.retrieve(
    "0e6f9b3a-6b1e-4b8a-9a6a-1c2d3e4f5a6b",
    period="2026-W33",  # or a month ("2026-08"), a year ("2026"), or "all"
)
print(reactions.total)  # a display value: exact up to 100, "100+" beyond
```

Async:

```python
from negirau import AsyncNegirau

async with AsyncNegirau() as client:
    page = await client.subjects.list(q="花火")
```

Errors and retries:

```python
from negirau import Negirau, NotFoundError, RateLimitError

client = Negirau(max_retries=2)  # 408/409/429/5xx retry with exponential backoff

try:
    client.subjects.retrieve("no-such-subject")
except NotFoundError as error:
    print(error.status_code, error.code)  # 404 not_found
except RateLimitError:
    ...
```

Types live in `negirau.types` (`Subject`, `SubjectPage`, `ReactionsSummary`, `DisplayValue`, …).

## Notes

- Counts are display values by design: exact up to 100, `"100+"` beyond, and never rankings — no API returns unbounded exact numbers.
- There are no bulk dumps: resolve names with `client.subjects.list(q=...)` (server-side trigram search, Japanese and English substrings).

## License

Apache-2.0.
This package lives in the [negirau monorepo](https://github.com/sincekmori/negirau), whose server code is separately licensed under AGPL-3.0-only.
