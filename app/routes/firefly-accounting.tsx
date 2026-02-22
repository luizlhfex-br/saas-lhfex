import { redirect } from "react-router";

export async function loader() {
  return redirect("/personal-life/finances");
}

export default function FireflyAccountingCompatibilityPage() {
  return null;
}
