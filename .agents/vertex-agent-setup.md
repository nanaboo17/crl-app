# Overview
This plan guides the setup of a Vertex AI Agent to act as a telecom data assistant. It focuses on structuring BigQuery data into "golden views" for the agent to query easily, rather than forcing the agent to navigate hundreds of raw tables.

# Project Type
BACKEND / DATA ENGINEERING

# Success Criteria
- The agent can answer all 61 prompts from the Boss Prompt Library.
- Data comparisons (DoD, WoW) are accurate.
- Anomalies are correctly identified.
- Forecasts are generated and used.

# Tech Stack
- **BigQuery:** Data storage, scheduled queries, BQML for forecasting.
- **Vertex AI Agent:** The AI interface, using a custom system prompt and a BigQuery tool.
- **Google Sheets (Optional):** For targets data source.

# File Structure
No code files need to be written in this repository. All configuration is done in GCP (BigQuery and Vertex AI Agent Builder).

# Task Breakdown

## Phase 1: Foundation (Data Structure)
- **Agent:** backend-specialist
- **Task:** Create SQL definition for `v_daily_national`.
- **INPUT:** Raw table schemas.
- **OUTPUT:** SQL script for `v_daily_national`.
- **VERIFY:** Query returns expected consolidated national data.

- **Agent:** backend-specialist
- **Task:** Create SQL definition for `v_daily_by_region`.
- **INPUT:** Raw table schemas.
- **OUTPUT:** SQL script for `v_daily_by_region`.
- **VERIFY:** Query returns data grouped by the 7 regions.

- **Agent:** backend-specialist
- **Task:** Create SQL definition for `v_daily_by_product`.
- **INPUT:** Raw table schemas.
- **OUTPUT:** SQL script for `v_daily_by_product`.
- **VERIFY:** Query returns data grouped by product.

- **Agent:** backend-specialist
- **Task:** Create SQL definition for `v_targets`.
- **INPUT:** Google Sheets target data format.
- **OUTPUT:** SQL script for `v_targets` (via external table).
- **VERIFY:** Target data is queryable in BQ.

## Phase 2: Helper Tables (Scheduled Queries)
- **Agent:** backend-specialist
- **Task:** Set up `compute_daily_comparison` scheduled query.
- **INPUT:** `v_daily_national` view.
- **OUTPUT:** Scheduled query definition.
- **VERIFY:** Table updates automatically and DoD/WoW calculations are correct.

- **Agent:** backend-specialist
- **Task:** Set up `compute_regional_anomalies` scheduled query.
- **INPUT:** `v_daily_by_region` view.
- **OUTPUT:** Scheduled query definition.
- **VERIFY:** Table identifies regions deviating from 7-day average.

## Phase 3: Vertex AI Agent Configuration
- **Agent:** project-planner
- **Task:** Configure Vertex AI Agent Tool and Instructions.
- **INPUT:** Finalized view schemas.
- **OUTPUT:** Configured Agent with BQ Tool and System Prompt.
- **VERIFY:** Agent can query the golden views.

- **Agent:** project-planner
- **Task:** Add Few-Shot Examples.
- **INPUT:** Boss Prompt Library examples.
- **OUTPUT:** Configured examples in Agent Builder.
- **VERIFY:** Agent format matches expected output.

## Phase 4: Forecasting
- **Agent:** backend-specialist
- **Task:** Create BQML ARIMA forecast models.
- **INPUT:** `v_daily_national` view.
- **OUTPUT:** BQML model definitions.
- **VERIFY:** Models train successfully.

- **Agent:** backend-specialist
- **Task:** Set up `compute_forecasts` scheduled query.
- **INPUT:** BQML models.
- **OUTPUT:** Scheduled query definition.
- **VERIFY:** Forecasts table updates daily with predictions.

## Phase X: Verification (Manual)
- [ ] Run the 5-prompt Quick Test against the configured Vertex AI Agent.
- [ ] Ensure no PII is exposed.
- [ ] Verify Agent does not attempt to modify data (read-only tool).
