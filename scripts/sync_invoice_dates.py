#!/usr/bin/env python3
"""Sync latest invoice information from BigQuery into public.customers.

Flow:
1. Read real billing accounts from Supabase public.customers (customer_id).
2. Query ftth_invoice_funnel_dtl only for those billing accounts.
3. Pick the latest funnel row per billing account.
4. Update invoice_date in Supabase. By default, only changed values are written.

Required environment variables:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  GCP_SERVICE_ACCOUNT_JSON

Optional:
  BIGQUERY_PROJECT=data-bi-prd-935c
  BIGQUERY_LOCATION=<BigQuery job location, e.g. asia-southeast2>
  DRY_RUN=true
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import date, datetime
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from google.cloud import bigquery
from google.oauth2 import service_account


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GCP_SERVICE_ACCOUNT_JSON = os.environ.get("GCP_SERVICE_ACCOUNT_JSON", "")
BIGQUERY_PROJECT = os.environ.get("BIGQUERY_PROJECT", "data-bi-prd-935c")
BIGQUERY_LOCATION = os.environ.get("BIGQUERY_LOCATION", "").strip() or None
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() in {"1", "true", "yes"}

PAGE_SIZE = 1000
PATCH_BATCH_PAUSE_SECONDS = 0.02


QUERY = r"""
#standardSQL
WITH funnel_latest AS (
  SELECT
    TRIM(CAST(f.billing_account AS STRING)) AS billing_account,
    SAFE_CAST(f.actual_bill_dtm AS TIMESTAMP) AS actual_bill_dtm,
    SAFE_CAST(f.payment_due_dat AS TIMESTAMP) AS payment_due_dat,
    f.invoice_num,
    f.balance_out_mny,
    ROW_NUMBER() OVER (
      PARTITION BY TRIM(CAST(f.billing_account AS STRING))
      ORDER BY
        SAFE_CAST(f.dt_id AS DATE) DESC NULLS LAST,
        SAFE_CAST(f.actual_bill_dtm AS TIMESTAMP) DESC NULLS LAST,
        SAFE_CAST(f.payment_due_dat AS TIMESTAMP) DESC NULLS LAST
    ) AS rn
  FROM `data-bi-prd-935c.bi_dm.ftth_invoice_funnel_dtl` f
  WHERE f.billing_account IS NOT NULL
    AND TRIM(CAST(f.billing_account AS STRING)) IN UNNEST(@billing_accounts)
)
SELECT
  billing_account,
  actual_bill_dtm,
  payment_due_dat,
  invoice_num,
  balance_out_mny
FROM funnel_latest
WHERE rn = 1
ORDER BY billing_account
"""


def require_env() -> None:
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_ROLE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not GCP_SERVICE_ACCOUNT_JSON:
        missing.append("GCP_SERVICE_ACCOUNT_JSON")
    if missing:
        raise RuntimeError("Missing required environment variables: " + ", ".join(missing))


def supabase_request(method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    payload = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if method == "PATCH":
        headers["Prefer"] = "return=minimal"

    req = Request(url, data=payload, headers=headers, method=method)
    try:
        with urlopen(req, timeout=60) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path} failed: HTTP {exc.code}: {detail}") from exc


def fetch_customers() -> dict[str, str | None]:
    """Return {billing_account/customer_id: current invoice_date}."""
    result: dict[str, str | None] = {}
    offset = 0

    while True:
        params = urlencode(
            {
                "select": "customer_id,invoice_date",
                "customer_id": "not.like.DUMMY-%",
                "order": "customer_id.asc",
                "limit": PAGE_SIZE,
                "offset": offset,
            }
        )
        rows = supabase_request("GET", f"customers?{params}") or []
        for row in rows:
            customer_id = str(row.get("customer_id") or "").strip()
            if customer_id:
                result[customer_id] = row.get("invoice_date")

        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    return result


def make_bigquery_client() -> bigquery.Client:
    info = json.loads(GCP_SERVICE_ACCOUNT_JSON)
    credentials = service_account.Credentials.from_service_account_info(info)
    return bigquery.Client(project=BIGQUERY_PROJECT, credentials=credentials)


def normalize_date(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if not text:
        return None
    return text[:10]


def query_latest_invoices(client: bigquery.Client, billing_accounts: list[str]) -> dict[str, dict[str, Any]]:
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ArrayQueryParameter("billing_accounts", "STRING", billing_accounts)
        ]
    )
    kwargs: dict[str, Any] = {"job_config": job_config}
    if BIGQUERY_LOCATION:
        kwargs["location"] = BIGQUERY_LOCATION

    rows = client.query(QUERY, **kwargs).result()
    found: dict[str, dict[str, Any]] = {}
    for row in rows:
        account = str(row["billing_account"]).strip()
        found[account] = {
            "invoice_date": normalize_date(row["actual_bill_dtm"]),
            "payment_due_date": normalize_date(row["payment_due_dat"]),
            "invoice_num": row["invoice_num"],
            "balance_out_mny": row["balance_out_mny"],
        }
    return found


def update_invoice_date(customer_id: str, invoice_date: str) -> None:
    encoded_id = customer_id.replace("%", "%25").replace(" ", "%20")
    supabase_request("PATCH", f"customers?customer_id=eq.{encoded_id}", {"invoice_date": invoice_date})


def main() -> int:
    require_env()

    customers = fetch_customers()
    billing_accounts = sorted(customers)
    print(f"Supabase real billing accounts: {len(billing_accounts)}")

    if not billing_accounts:
        print("No billing accounts found; nothing to sync.")
        return 0

    bq = make_bigquery_client()
    latest = query_latest_invoices(bq, billing_accounts)
    print(f"BigQuery accounts with invoice records: {len(latest)}")

    missing = [account for account in billing_accounts if account not in latest]
    if missing:
        print(f"No BigQuery invoice record: {len(missing)}")

    changed: list[tuple[str, str | None, str]] = []
    no_invoice_date = 0

    for account, values in latest.items():
        new_date = values["invoice_date"]
        if not new_date:
            no_invoice_date += 1
            continue
        old_date = customers.get(account)
        if old_date != new_date:
            changed.append((account, old_date, new_date))

    print(f"Invoice dates needing update: {len(changed)}")
    if no_invoice_date:
        print(f"Latest BigQuery rows without actual_bill_dtm: {no_invoice_date}")

    if DRY_RUN:
        for account, old_date, new_date in changed[:25]:
            print(f"DRY RUN {account}: {old_date} -> {new_date}")
        if len(changed) > 25:
            print(f"... and {len(changed) - 25} more")
        return 0

    updated = 0
    for account, old_date, new_date in changed:
        update_invoice_date(account, new_date)
        updated += 1
        print(f"Updated {account}: {old_date} -> {new_date}")
        time.sleep(PATCH_BATCH_PAUSE_SECONDS)

    print("---")
    print(f"Finished. Updated: {updated}; unchanged: {len(latest) - len(changed) - no_invoice_date}; missing in BQ: {len(missing)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
