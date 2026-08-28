-- ==============================================================================
-- PHASE 1: GOLDEN VIEWS
-- Replace `your_project.your_dataset` with your actual BigQuery project and dataset.
-- Also replace the logic inside the FROM subqueries with your actual tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. v_daily_national
-- One row per day with all national KPIs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW `your_project.your_dataset.v_daily_national` AS
SELECT
  date,                          -- DATE: the metric date
  churn_count,                   -- INT64: number of churned customers
  churn_rate,                    -- FLOAT64: churn rate as percentage (e.g. 2.1)
  gross_adds,                    -- INT64: new customers added
  net_adds,                      -- INT64: gross_adds minus churn
  active_customers,              -- INT64: total active customer base
  total_sales,                   -- FLOAT64: total sales revenue (in Rupiah)
  arpu                           -- FLOAT64: average revenue per user
FROM (
  -- TODO: JOIN YOUR RAW TABLES HERE
  SELECT 
    CURRENT_DATE() AS date, 
    0 AS churn_count, 
    0.0 AS churn_rate,
    0 AS gross_adds, 
    0 AS net_adds, 
    0 AS active_customers,
    0.0 AS total_sales, 
    0.0 AS arpu
);

-- ------------------------------------------------------------------------------
-- 2. v_daily_by_region
-- One row per day per region
-- Regions MUST BE EXACTLY: 'CJ', 'EJ', 'JABO 1', 'JABO 2', 'NS', 'WJ', 'SS'
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW `your_project.your_dataset.v_daily_by_region` AS
SELECT
  date,
  region,
  churn_count,
  churn_rate,
  gross_adds,
  net_adds,
  active_customers,
  total_sales,
  arpu
FROM (
  -- TODO: MAP YOUR REGIONAL TABLES HERE
  SELECT 
    CURRENT_DATE() AS date, 
    'CJ' AS region, 
    0 AS churn_count, 
    0.0 AS churn_rate,
    0 AS gross_adds, 
    0 AS net_adds, 
    0 AS active_customers,
    0.0 AS total_sales, 
    0.0 AS arpu
);

-- ------------------------------------------------------------------------------
-- 3. v_daily_by_product
-- One row per day per product/plan
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW `your_project.your_dataset.v_daily_by_product` AS
SELECT
  date,
  product,
  churn_count,
  churn_rate,
  gross_adds,
  net_adds,
  active_customers,
  total_sales,
  arpu
FROM (
  -- TODO: MAP YOUR PRODUCT TABLES HERE
  SELECT 
    CURRENT_DATE() AS date, 
    'Prepaid' AS product, 
    0 AS churn_count, 
    0.0 AS churn_rate,
    0 AS gross_adds, 
    0 AS net_adds, 
    0 AS active_customers,
    0.0 AS total_sales, 
    0.0 AS arpu
);

-- ------------------------------------------------------------------------------
-- 4. v_targets
-- Assuming you have linked Google Sheets as an external table `ext_targets`
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW `your_project.your_dataset.v_targets` AS
SELECT
  month,                         -- DATE: first day of month
  metric_name,                   -- STRING: 'churn_rate', 'gross_adds', 'sales', etc.
  target_value,                  -- FLOAT64: the target value
  region                         -- STRING: region or 'NATIONAL' for overall
FROM `your_project.your_dataset.ext_targets`;
