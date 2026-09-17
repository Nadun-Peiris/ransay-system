import { SalesReportPage } from "@/components/sales-report-page";

export default function TotalSalesPage() {
  return (
    <SalesReportPage
      title="Total Sales"
      subtitle="Full sales report across all eligible orders."
      endpoint="/api/reports/total-sales"
      superadminOnly
    />
  );
}
