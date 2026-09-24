function formatDate(date) {
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "short" }).format(date);
}

function buildReport(rows) {
  return rows.map((r) => `${formatDate(r.date)}: ${r.label}`).join("\n");
}

module.exports = { formatDate, buildReport };
