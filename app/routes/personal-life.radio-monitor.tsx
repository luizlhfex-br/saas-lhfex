import { redirect } from "react-router";

export async function loader() {
	return redirect("/radio-monitor");
}

export default function PersonalLifeRadioMonitorPage() {
	return null;
}
