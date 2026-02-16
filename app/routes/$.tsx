import { Link } from "react-router";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";

export async function loader() {
  throw new Response("Not Found", { status: 404 });
}

export default function CatchAll() {
  return null;
}
