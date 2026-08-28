-- ==============================================================================
-- PHASE 2: HELPER TABLES (SCHEDULED QUERIES)
-- Set these up as Scheduled Queries in BigQuery to run every day at 14:30 WIB.
-- Replace `your_project.your_dataset` with your actual dataset.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. compute_daily_comparison
-- Pre-calculates DoD, WoW, MoM changes and anomaly flags for the agent.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE TABLE `your_project.your_dataset.daily_comparison` AS
WITH today AS (
  SELECT * FROM `your_project.your_dataset.v_daily_national`
  WHERE date = (SELECT MAX(date) FROM `your_project.your_dataset.v_daily_national`)
),
yesterday AS (
  SELECT * FROM `your_project.your_dataset.v_daily_national`
  WHERE date = (SELECT MAX(date) - 1 FROM `your_project.your_dataset.v_daily_national`)
),
last_week AS (
  SELECT * FROM `your_project.your_dataset.v_daily_national`
  WHERE date = (SELECT MAX(date) - 7 FROM `your_project.your_dataset.v_daily_national`)
),
last_month AS (
  SELECT * FROM `your_project.your_dataset.v_daily_national`
  WHERE date = DATE_SUB((SELECT MAX(date) FROM `your_project.your_dataset.v_daily_national`), INTERVAL 1 MONTH)
)
SELECT
  t.date AS report_date,

  -- Churn
  t.churn_rate,
  t.churn_count,
  y.churn_rate AS churn_rate_yesterday,
  ROUND(t.churn_rate - y.churn_rate, 2) AS churn_dod_change,
  ROUND(SAFE_DIVIDE(t.churn_rate - y.churn_rate, y.churn_rate) * 100, 1) AS churn_dod_pct,
  lw.churn_rate AS churn_rate_last_week,
  ROUND(SAFE_DIVIDE(t.churn_rate - lw.churn_rate, lw.churn_rate) * 100, 1) AS churn_wow_pct,
  lm.churn_rate AS churn_rate_last_month,
  ROUND(SAFE_DIVIDE(t.churn_rate - lm.churn_rate, lm.churn_rate) * 100, 1) AS churn_mom_pct,

  -- Gross Adds
  t.gross_adds,
  y.gross_adds AS gross_adds_yesterday,
  t.gross_adds - y.gross_adds AS gross_adds_dod_change,
  ROUND(SAFE_DIVIDE(t.gross_adds - y.gross_adds, y.gross_adds) * 100, 1) AS gross_adds_dod_pct,
  lw.gross_adds AS gross_adds_last_week,
  ROUND(SAFE_DIVIDE(t.gross_adds - lw.gross_adds, lw.gross_adds) * 100, 1) AS gross_adds_wow_pct,

  -- Sales
  t.total_sales,
  y.total_sales AS sales_yesterday,
  ROUND(SAFE_DIVIDE(t.total_sales - y.total_sales, y.total_sales) * 100, 1) AS sales_dod_pct,
  lw.total_sales AS sales_last_week,
  ROUND(SAFE_DIVIDE(t.total_sales - lw.total_sales, lw.total_sales) * 100, 1) AS sales_wow_pct,

  -- Customers & Net Adds
  t.active_customers,
  y.active_customers AS customers_yesterday,
  t.active_customers - y.active_customers AS customer_change,
  t.net_adds,

  -- Anomaly Flags (>10% change)
  ABS(SAFE_DIVIDE(t.churn_rate - y.churn_rate, y.churn_rate)) > 0.10 AS is_churn_anomaly,
  ABS(SAFE_DIVIDE(CAST(t.gross_adds - y.gross_adds AS FLOAT64), y.gross_adds)) > 0.10 AS is_adds_anomaly,
  ABS(SAFE_DIVIDE(t.total_sales - y.total_sales, y.total_sales)) > 0.10 AS is_sales_anomaly
FROM today t
LEFT JOIN yesterday y ON TRUE
LEFT JOIN last_week lw ON TRUE
LEFT JOIN last_month lm ON TRUE;

-- ------------------------------------------------------------------------------
-- 2. compute_regional_anomalies
-- Highlights regions deviating significantly from their 7-day average.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE TABLE `your_project.your_dataset.regional_anomalies` AS
WITH latest_date AS (
  SELECT MAX(date) AS max_date FROM `your_project.your_dataset.v_daily_by_region`
),
today_data AS (
  SELECT * FROM `your_project.your_dataset.v_daily_by_region`
  WHERE date = (SELECT max_date FROM latest_date)
),
avg_7d AS (
  SELECT
    region,
    AVG(churn_rate) AS avg_churn_7d,
    AVG(gross_adds) AS avg_adds_7d,
    AVG(total_sales) AS avg_sales_7d,
    STDDEV(churn_rate) AS stddev_churn
  FROM `your_project.your_dataset.v_daily_by_region`
  WHERE date BETWEEN (SELECT max_date - 8 FROM latest_date) AND (SELECT max_date - 1 FROM latest_date)
  GROUP BY region
)
SELECT
  t.date,
  t.region,
  CASE t.region
    WHEN 'CJ' THEN 'Central Java'
    WHEN 'EJ' THEN 'East Java'
    WHEN 'JABO 1' THEN 'Jabodetabek 1'
    WHEN 'JABO 2' THEN 'Jabodetabek 2'
    WHEN 'NS' THEN 'North Sumatra'
    WHEN 'WJ' THEN 'West Java'
    WHEN 'SS' THEN 'South Sulawesi'
    ELSE t.region
  END AS region_name,
  
  -- Churn Evaluation
  t.churn_rate,
  a.avg_churn_7d,
  ROUND(t.churn_rate - a.avg_churn_7d, 2) AS churn_deviation,
  CASE
    WHEN t.churn_rate > a.avg_churn_7d + 2 * IFNULL(a.stddev_churn, 0) THEN 'HIGH_ALERT'
    WHEN t.churn_rate > a.avg_churn_7d + IFNULL(a.stddev_churn, 0) THEN 'WARNING'
    WHEN t.churn_rate < a.avg_churn_7d - IFNULL(a.stddev_churn, 0) THEN 'IMPROVED'
    ELSE 'NORMAL'
  END AS churn_status,

  -- Gross Adds and Sales context
  t.gross_adds,
  CAST(ROUND(a.avg_adds_7d) AS INT64) AS avg_adds_7d,
  t.total_sales,
  a.avg_sales_7d,
  t.active_customers
FROM today_data t
LEFT JOIN avg_7d a USING (region)
ORDER BY churn_deviation DESC;
