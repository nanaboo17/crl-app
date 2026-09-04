function inspectHourlyPaymentSchema() {
  const projectId = 'data-bi-prd-935c';

  const query = `
    #standardSQL
    SELECT
      column_name,
      data_type,
      ordinal_position
    FROM \`data-dtp-prd-aa1a.stg.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = 'ftth_bill_payment_hourly'
    ORDER BY ordinal_position
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

function previewHourlyPaymentRows() {
  const projectId = 'data-bi-prd-935c';

  const query = `
    #standardSQL
    SELECT *
    FROM \`data-dtp-prd-aa1a.stg.ftth_bill_payment_hourly\`
    LIMIT 3
  `;

  const request = {
    query: query,
    useLegacySql: false,
    maxResults: 3
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
