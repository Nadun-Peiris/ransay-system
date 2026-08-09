import { SalesReportPage } from "@/components/sales-report-page";

export default function SalesPage() {
  return (
    <SalesReportPage
      title="Sales"
      subtitle="Sales report based on selected-orders-visible orders."
      endpoint="/api/reports/sales"
      showCreatedByFilter={false}
    />
  );
}
