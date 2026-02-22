import { redirect } from "react-router";

export async function loader() {
  return redirect("/personal-life/finances/budgets");
}

export default function FireflyBudgetsCompatibilityPage() {
  return null;
}
