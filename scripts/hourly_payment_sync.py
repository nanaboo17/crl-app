import json
import os
import sys
from datetime import datetime, timezone

import requests
from google.cloud import bigquery
from google.oauth2 import service_account


QUERY = r"""
#standardSQL
WITH latest_cumulative_dt AS (
  SELECT MAX(SAFE_CAST(dt_id AS DATE)) AS latest_dt_id
  FROM `data-bi-prd-935c.bi_dm.ftth_cumulative_subs_v2`
),
base AS (
  SELECT
    TRIM(CAST(c.billing_account AS STRING)) AS billing_account
  FROM `data-bi-prd-935c.bi_dm.ftth_cumulative_subs_v2` c
  CROSS JOIN latest_cumulative_dt d
  WHERE SAFE_CAST(c.dt_id AS DATE) = d.latest_dt_id
    AND UPPER(TRIM(c.flag_account)) = 'SUSPENSION-BUCKET 1'
    AND c.billing_account IS NOT NULL
),
funnel_latest AS (
  SELECT billing_account, actual_bill_dtm
  FROM (
    SELECT
      TRIM(CAST(f.billing_account AS STRING)) AS billing_account,
      SAFE_CAST(f.actual_bill_dtm AS TIMESTAMP) AS actual_bill_dtm,
      ROW_NUMBER() OVER (
        PARTITION BY TRIM(CAST(f.billing_account AS STRING))
        ORDER BY
          SAFE_CAST(f.dt_id AS DATE) DESC NULLS LAST,
          SAFE_CAST(f.actual_bill_dtm AS TIMESTAMP) DESC NULLS LAST,
          SAFE_CAST(f.payment_due_dat AS TIMESTAMP) DESC NULLS LAST
      ) AS rn
    FROM `data-bi-prd-935c.bi_dm.ftth_invoice_funnel_dtl` f
    INNER JOIN base b
      ON TRIM(CAST(f.billing_account AS STRING)) = b.billing_account
    WHERE f.billing_account IS NOT NULL
  )
  WHERE rn = 1
),
payment_hourly AS (
  SELECT DISTINCT
    TRIM(CAST(p.billing_account AS STRING)) AS billing_account,
    TIMESTAMP_TRUNC(SAFE_CAST(p.actual_bill_dtm AS TIMESTAMP), SECOND) AS actual_bill_dtm
  FROM `data-dtp-prd-aa1a.stg.ftth_bill_payment_hourly` p
  INNER JOIN funnel_latest f
    ON TRIM(CAST(p.billing_account AS STRING)) = f.billing_account
   AND TIMESTAMP_TRUNC(SAFE_CAST(p.actual_bill_dtm AS TIMESTAMP), SECOND)
       = TIMESTAMP_TRUNC(f.actual_bill_dtm, SECOND)
  WHERE p.billing_account IS NOT NULL
    AND p.actual_bill_dtm IS NOT NULL
)
SELECT
  f.billing_account AS customer_id,
  f.actual_bill_dtm,
  CASE WHEN p.billing_account IS NOT NULL THEN 'paid' ELSE 'unpaid' END AS payment_status
FROM funnel_latest f
LEFT JOIN payment_hourly p
  ON p.billing_account = f.billing_account
 AND p.actual_bill_dtm = TIMESTAMP_TRUNC(f.actual_bill_dtm, SECOND)
ORDER BY f.billing_account
"""


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def build_bigquery_client() -> bigquery.Client:
    raw_credentials = required_env("GCP_SERVICE_ACCOUNT_JSON")
    info = json.loads(raw_credentials)
    credentials = service_account.Credentials.from_service_account_info(info)
    project = os.getenv("BIGQUERY_BILLING_PROJECT") or info.get("project_id")
    if not project:
        raise RuntimeError("BIGQUERY_BILLING_PROJECT is required when project_id is absent from credentials")
    return bigquery.Client(project=project, credentials=credentials)


def rpc_sync(rows: list[dict]) -> int:
    supabase_url = required_env("SUPABASE_URL").rstrip("/")
    service_key = required_env("SUPABASE_SERVICE_ROLE_KEY")
    response = requests.post(
        f"{supabase_url}/rest/v1/rpc/sync_customer_payment_statuses",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        },
        json={"p_rows": rows},
        timeout=60,
    )
    response.raise_for_status()
    return int(response.json())


def main() -> None:
    started_at = datetime.now(timezone.utc)
    print(f"payment sync started at {started_at.isoformat()}")

    client = build_bigquery_client()
    result = client.query(QUERY).result()

    payload: list[dict] = []
    for row in result:
        payload.append(
            {
                "customer_id": str(row.customer_id).strip(),
                "actual_bill_dtm": row.actual_bill_dtm.isoformat() if row.actual_bill_dtm else None,
                "payment_status": row.payment_status,
            }
        )

    if not payload:
        print("No eligible billing accounts returned; nothing to update.")
        return

    updated = 0
    batch_size = int(os.getenv("PAYMENT_SYNC_BATCH_SIZE", "500"))
    for start in range(0, len(payload), batch_size):
        batch = payload[start : start + batch_size]
        updated += rpc_sync(batch)

    paid = sum(1 for row in payload if row["payment_status"] == "paid")
    unpaid = len(payload) - paid
    finished_at = datetime.now(timezone.utc)
    print(
        f"payment sync completed: source_rows={len(payload)} updated={updated} "
        f"paid={paid} unpaid={unpaid} finished_at={finished_at.isoformat()}"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"payment sync failed: {exc}", file=sys.stderr)
        raise
