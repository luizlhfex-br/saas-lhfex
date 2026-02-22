import { redirect } from "react-router";

export async function loader() {
	return redirect("/firefly-budgets");
}

export default function PersonalLifeFinancesBudgetsPage() {
	return null;
}
