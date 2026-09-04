function testBigQueryPaymentAccess() {
  const projectId = 'data-bi-prd-935c';

  const query = `
    #standardSQL
    SELECT
      TRIM(CAST(billing_account AS STRING)) AS billing_account,
      SAFE_CAST(actual_bill_dtm AS TIMESTAMP) AS actual_bill_dtm
    FROM \`data-dtp-prd-aa1a.stg.ftth_bill_payment_hourly\`
    WHERE billing_account IS NOT NULL
      AND actual_bill_dtm IS NOT NULL
    ORDER BY SAFE_CAST(actual_bill_dtm AS TIMESTAMP) DESC
    LIMIT 10
  `;

  const request = {
    query: query,
    useLegacySql: false
  };

  const result = BigQuery.Jobs.query(request, projectId);

  if (!result.jobComplete) {
    throw new Error('BigQuery job did not complete immediately. Run the test again or inspect the execution log.');
  }

  const fields = (result.schema && result.schema.fields) || [];
  const rows = result.rows || [];

  const output = rows.map(function (row) {
    const obj = {};
    row.f.forEach(function (cell, index) {
      obj[fields[index].name] = cell.v;
    });
    return obj;
  });

  console.log(JSON.stringify(output, null, 2));
  Logger.log(JSON.stringify(output, null, 2));

  return output;
}
