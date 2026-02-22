import { redirect } from "react-router";

export async function loader() {
  return redirect("/personal-life/radio-monitor");
}

export default function PersonalLifeTimeoffPage() {
  return null;
}
