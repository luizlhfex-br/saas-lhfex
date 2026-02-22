import { redirect } from "react-router";

export async function loader() {
	return redirect("/firefly-transactions");
}

export default function PersonalLifeFinancesTransactionsPage() {
	return null;
}
