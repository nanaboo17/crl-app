-- ==============================================================================
-- PHASE 4: FORECASTING MODELS
-- Replace `your_project.your_dataset` with your actual dataset.
-- Run these one time to create the models, then set up the scheduled query.
-- ==============================================================================

-- 1. Churn Forecast Model
CREATE OR REPLACE MODEL `your_project.your_dataset.model_churn_forecast`
OPTIONS(
  model_type = 'ARIMA_PLUS',
  time_series_timestamp_col = 'date',
  time_series_data_col = 'churn_rate',
  auto_arima = TRUE,
  data_frequency = 'DAILY',
  horizon = 30
) AS
SELECT date, churn_rate
FROM `your_project.your_dataset.v_daily_national`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY);

-- 2. Gross Adds Forecast Model
CREATE OR REPLACE MODEL `your_project.your_dataset.model_adds_forecast`
OPTIONS(
  model_type = 'ARIMA_PLUS',
  time_series_timestamp_col = 'date',
  time_series_data_col = 'gross_adds_float',
  auto_arima = TRUE,
  data_frequency = 'DAILY',
  horizon = 30
) AS
SELECT date, CAST(gross_adds AS FLOAT64) AS gross_adds_float
FROM `your_project.your_dataset.v_daily_national`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY);

-- 3. Sales Forecast Model
CREATE OR REPLACE MODEL `your_project.your_dataset.model_sales_forecast`
OPTIONS(
  model_type = 'ARIMA_PLUS',
  time_series_timestamp_col = 'date',
  time_series_data_col = 'total_sales',
  auto_arima = TRUE,
  data_frequency = 'DAILY',
  horizon = 30
) AS
SELECT date, total_sales
FROM `your_project.your_dataset.v_daily_national`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY);

-- ==============================================================================
-- SCHEDULED QUERY: Write Forecasts Daily
-- Schedule: Every day at 14:45 WIB
-- ==============================================================================
CREATE OR REPLACE TABLE `your_project.your_dataset.forecasts` AS

SELECT 'churn_rate' AS metric_name,
       forecast_timestamp AS forecast_date,
       forecast_value, confidence_level,
       prediction_interval_lower_bound AS lower_bound,
       prediction_interval_upper_bound AS upper_bound
FROM ML.FORECAST(MODEL `your_project.your_dataset.model_churn_forecast`,
                 STRUCT(30 AS horizon, 0.95 AS confidence_level))

UNION ALL

SELECT 'gross_adds' AS metric_name,
       forecast_timestamp AS forecast_date,
       forecast_value, confidence_level,
       prediction_interval_lower_bound AS lower_bound,
       prediction_interval_upper_bound AS upper_bound
FROM ML.FORECAST(MODEL `your_project.your_dataset.model_adds_forecast`,
                 STRUCT(30 AS horizon, 0.95 AS confidence_level))

UNION ALL

SELECT 'total_sales' AS metric_name,
       forecast_timestamp AS forecast_date,
       forecast_value, confidence_level,
       prediction_interval_lower_bound AS lower_bound,
       prediction_interval_upper_bound AS upper_bound
FROM ML.FORECAST(MODEL `your_project.your_dataset.model_sales_forecast`,
                 STRUCT(30 AS horizon, 0.95 AS confidence_level));
