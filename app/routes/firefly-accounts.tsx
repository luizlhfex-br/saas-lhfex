import { redirect } from "react-router";

export async function loader() {
  return redirect("/personal-life/finances/accounts");
}

export default function FireflyAccountsCompatibilityPage() {
  return null;
}
