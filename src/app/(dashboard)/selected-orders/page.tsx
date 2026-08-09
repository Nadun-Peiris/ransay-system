import { redirect } from "next/navigation";

export default function SelectedOrdersRedirectPage() {
  redirect("/orders");
}
