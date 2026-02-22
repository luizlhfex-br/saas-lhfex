import { redirect } from "react-router";

export async function loader() {
  return redirect("/personal-life/promotions");
}

export default function CompanyPromotionsCompatibilityPage() {
  return null;
}
