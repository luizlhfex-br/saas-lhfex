import { redirect } from "react-router";

export async function loader() {
	return redirect("/firefly-recurring");
}

export default function PersonalLifeFinancesRecurringPage() {
	return null;
}
