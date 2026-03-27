import { redirect } from "react-router";

export async function loader() {
  return redirect("/personal-life/finances");
}

export async function action() {
  return redirect("/personal-life/finances");
}

export default function PersonalLifeFinancesRecurringRedirectPage() {
  return null;
}
