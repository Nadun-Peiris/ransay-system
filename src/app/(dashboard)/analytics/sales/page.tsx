import { SalesReportPage } from "@/components/sales-report-page";

export default function SalesPage() {
  return (
    <SalesReportPage
      title="Sales"
      subtitle="Selected orders sales report."
      endpoint="/api/reports/sales"
      showCreatedByFilter={false}
    />
  );
}
