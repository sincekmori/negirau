# SPDX-License-Identifier: Apache-2.0
"""Spec-conformance contract tests (the replacement for code generation).

The client is hand-written; these tests are what make that safe. They load the
canonical, build-time-generated openapi.json (servers: api.negirau.com/v1) and prove:

1. every spec operation is exercised by a client method, and every client
   request targets a spec path with spec-declared query parameters only;
2. reaction totals stay display-value strings (never numbers) in the spec;
3. for each operation, a sample payload first proven valid against the spec's
   response schema (jsonschema) is accepted by the client's models.

If the API grows or changes shape, these tests fail until the client catches up
— the same drift guarantee generation gave, without generated code.
"""

import json
import re
from pathlib import Path

import httpx
import jsonschema
import pytest

from negirau import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncNegirau,
    BadRequestError,
    InternalServerError,
    Negirau,
    NotFoundError,
    RateLimitError,
)

SPEC = json.loads(
    (Path(__file__).parents[3] / "public" / "v1" / "openapi.json").read_text()
)

SUBJECT_ID = "0e6f9b3a-6b1e-4b8a-9a6a-1c2d3e4f5a6b"

SUBJECT_SAMPLE = {
    "id": SUBJECT_ID,
    "name": "世田谷消防署",
    "lat": 35.6466,
    "lng": 139.6532,
}

# A subject is "a name, optionally with a location" — the location-less
# variant is first-class, so the parsing path must be pinned too.
NAME_ONLY_SAMPLE = {
    "id": "6f1d2c3b-4a59-4e6f-8a7b-9c0d1e2f3a4b",
    "name": "山田 太郎",
    "lat": None,
    "lng": None,
}

# One entry per spec operation: sample 200 payload (validated against the spec
# schema before the client must parse it) and the client call that consumes it.
OPERATIONS = {
    "/subjects": {
        "payload": {
            "subjects": [SUBJECT_SAMPLE, NAME_ONLY_SAMPLE],
            "next_cursor": None,
        },
        "calls": [
            lambda c: c.subjects.list(q="消防署", limit=5),
            lambda c: c.subjects.list(cursor="abc"),
        ],
    },
    "/subjects/{id}": {
        "payload": SUBJECT_SAMPLE,
        "calls": [lambda c: c.subjects.retrieve(SUBJECT_ID)],
    },
    "/subjects/{id}/reactions": {
        "payload": {
            "id": SUBJECT_ID,
            "period": "2026-W33",
            "total": "100+",
            "by_type": {"heart": "80", "like": "40"},
        },
        "calls": [
            lambda c: c.subjects.reactions.retrieve(SUBJECT_ID, period="2026-W33")
        ],
    },
}

# The near variant answers on /subjects with a different response shape.
NEAR_PAYLOAD = {"subjects": [{**SUBJECT_SAMPLE, "distance_m": 1808}]}


def spec_operation(template: str) -> dict:
    return SPEC["paths"][template]["get"]


def response_schema(template: str) -> dict:
    return spec_operation(template)["responses"]["200"]["content"]["application/json"][
        "schema"
    ]


def client_for(handler, *, max_retries: int = 0) -> Negirau:
    http = httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://negirau.test"
    )
    return Negirau(http_client=http, max_retries=max_retries)


def async_client_for(handler, *, max_retries: int = 0) -> AsyncNegirau:
    http = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://negirau.test"
    )
    return AsyncNegirau(http_client=http, max_retries=max_retries)


def capture_call(call, payload) -> httpx.Request:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        return httpx.Response(200, json=payload)

    with client_for(handler) as client:
        call(client)
    return captured["request"]


def declared_query_params(template: str) -> set[str]:
    parameters = spec_operation(template).get("parameters", [])
    return {p["name"] for p in parameters if p["in"] == "query"}


def matching_template(path: str) -> str | None:
    """Resolve a concrete request path to the spec template it instantiates.

    Parameter values are single path segments (the client URL-encodes ids).
    """
    for template in SPEC["paths"]:
        pattern = re.sub(r"\{[^}]+\}", "[^/]+", template)
        if re.fullmatch(pattern, path):
            return template
    return None


def test_reaction_totals_are_display_value_strings():
    total_schema = response_schema("/subjects/{id}/reactions")["properties"]["total"]
    assert total_schema["type"] == "string"
    assert "enum" not in total_schema


def test_every_spec_operation_is_covered():
    assert sorted(SPEC["paths"]) == sorted(OPERATIONS)


@pytest.mark.parametrize(
    ("template", "entry"), OPERATIONS.items(), ids=list(OPERATIONS)
)
def test_spec_valid_payload_spec_path_and_declared_parameters(template, entry):
    # The payload is spec-validated once; each call is captured once (parsing
    # raises inside) and checked for path-template + parameter conformance.
    jsonschema.validate(entry["payload"], response_schema(template))
    for call in entry["calls"]:
        request = capture_call(call, entry["payload"])
        assert matching_template(request.url.path) == template
        declared = declared_query_params(template)
        sent = set(httpx.QueryParams(request.url.query).keys())
        assert sent <= declared, f"undeclared query parameters: {sent - declared}"


def test_near_search_uses_declared_parameters_and_parses():
    jsonschema.validate(NEAR_PAYLOAD, response_schema("/subjects"))
    request = capture_call(
        lambda c: c.subjects.list_near(35.6, 139.65, radius=3000, limit=5), NEAR_PAYLOAD
    )
    assert set(httpx.QueryParams(request.url.query).keys()) <= declared_query_params(
        "/subjects"
    )


@pytest.mark.parametrize(
    ("status", "error_class"),
    [
        (400, BadRequestError),
        (404, NotFoundError),
        (502, InternalServerError),
        # Unmapped statuses fall back to the base class, not a subclass.
        (418, APIStatusError),
    ],
)
def test_status_errors_map_to_their_classes(status, error_class):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json={"error": "some_code"})

    with client_for(handler) as client, pytest.raises(error_class) as excinfo:
        client.subjects.retrieve("nope")
    assert type(excinfo.value) is error_class
    assert excinfo.value.status_code == status
    assert excinfo.value.code == "some_code"


def test_non_json_error_bodies_fall_back_to_unknown():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, text="Bad Gateway")  # not JSON

    with client_for(handler) as client, pytest.raises(BadRequestError) as excinfo:
        client.subjects.retrieve("anything")
    assert excinfo.value.code == "unknown"


def test_retryable_statuses_are_retried_until_success(monkeypatch):
    monkeypatch.setattr("negirau._client.time.sleep", lambda _s: None)
    attempts = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(request)
        if len(attempts) < 3:
            return httpx.Response(429, json={"error": "rate_limited"})
        return httpx.Response(200, json=SUBJECT_SAMPLE)

    with client_for(handler, max_retries=2) as client:
        subject = client.subjects.retrieve(SUBJECT_ID)
    assert subject.id == SUBJECT_SAMPLE["id"]
    assert len(attempts) == 3


def test_retries_exhausted_raise_the_status_error(monkeypatch):
    monkeypatch.setattr("negirau._client.time.sleep", lambda _s: None)
    attempts = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(request)
        return httpx.Response(429, json={"error": "rate_limited"})

    with client_for(handler, max_retries=1) as client, pytest.raises(RateLimitError):
        client.subjects.retrieve("x")
    assert len(attempts) == 2


def test_timeouts_retry_then_raise_api_timeout_error(monkeypatch):
    monkeypatch.setattr("negirau._client.time.sleep", lambda _s: None)
    attempts = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(request)
        raise httpx.ReadTimeout("slow")

    with client_for(handler, max_retries=1) as client, pytest.raises(APITimeoutError):
        client.subjects.retrieve("x")
    assert len(attempts) == 2


def test_connection_errors_raise_api_connection_error():
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    with client_for(handler) as client, pytest.raises(APIConnectionError):
        client.subjects.retrieve("x")


async def test_async_client_mirrors_the_sync_surface():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        payloads = {
            "/subjects": {"subjects": [SUBJECT_SAMPLE], "next_cursor": None}
            if "near" not in request.url.params
            else NEAR_PAYLOAD,
            "/subjects/" + SUBJECT_ID + "/reactions": OPERATIONS[
                "/subjects/{id}/reactions"
            ]["payload"],
            "/subjects/" + SUBJECT_ID: SUBJECT_SAMPLE,
        }
        return httpx.Response(200, json=payloads[request.url.path])

    async with async_client_for(handler) as client:
        page = await client.subjects.list(q="消防署")
        assert page.subjects[0].id == SUBJECT_SAMPLE["id"]
        nearby = await client.subjects.list_near(35.6, 139.65, radius=3000)
        assert nearby[0].distance_m == 1808
        subject = await client.subjects.retrieve(SUBJECT_ID)
        assert subject.name == SUBJECT_SAMPLE["name"]
        reactions = await client.subjects.reactions.retrieve(SUBJECT_ID)
        assert reactions.total == "100+"
    for request in requests:
        assert matching_template(request.url.path) is not None


async def test_async_retries_timeouts_and_status_errors(monkeypatch):
    async def no_sleep(_s: float) -> None:
        return None

    monkeypatch.setattr("negirau._client.asyncio.sleep", no_sleep)
    attempts = []

    def handler(request: httpx.Request) -> httpx.Response:
        attempts.append(request)
        if len(attempts) == 1:
            raise httpx.ReadTimeout("slow")
        if len(attempts) == 2:
            return httpx.Response(503, json={"error": "unavailable"})
        return httpx.Response(200, json=SUBJECT_SAMPLE)

    async with async_client_for(handler, max_retries=2) as client:
        subject = await client.subjects.retrieve(SUBJECT_ID)
    assert subject.id == SUBJECT_SAMPLE["id"]
    assert len(attempts) == 3


async def test_async_connection_error_and_not_found():
    calls = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            raise httpx.ConnectError("refused")
        return httpx.Response(404, json={"error": "not_found"})

    async with async_client_for(handler) as client:
        with pytest.raises(APIConnectionError):
            await client.subjects.retrieve("x")
        with pytest.raises(NotFoundError) as excinfo:
            await client.subjects.retrieve("nope")
    assert excinfo.value.code == "not_found"


def test_default_construction_targets_the_spec_server():
    # The one branch injected transports skip: the built-in httpx client and
    # its base URL, which must be the spec's server URL (would have caught a
    # botched /v1 migration on either side).
    with Negirau() as client:
        # httpx normalizes base URLs with a trailing slash.
        assert str(client._http.base_url) == SPEC["servers"][0]["url"] + "/"


async def test_async_default_construction_targets_the_spec_server():
    async with AsyncNegirau() as client:
        assert str(client._http.base_url) == SPEC["servers"][0]["url"] + "/"
