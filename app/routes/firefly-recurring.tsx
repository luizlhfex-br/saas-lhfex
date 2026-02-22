import { redirect } from "react-router";

export async function loader() {
  return redirect("/personal-life/finances/recurring");
}

export default function FireflyRecurringCompatibilityPage() {
  return null;
}
