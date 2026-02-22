import { redirect } from "react-router";

export async function loader() {
	return redirect("/firefly-accounts");
}

export default function PersonalLifeFinancesAccountsPage() {
	return null;
}
