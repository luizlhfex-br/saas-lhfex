import { redirect } from "react-router";

export async function loader() {
  return redirect("/personal-life/finances/transactions");
}

export default function FireflyTransactionsCompatibilityPage() {
  return null;
}
