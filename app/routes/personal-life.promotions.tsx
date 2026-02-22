import { redirect } from "react-router";

export async function loader() {
	return redirect("/company-promotions");
}

export default function PersonalLifePromotionsPage() {
	return null;
}
