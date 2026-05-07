import { redirect } from "next/navigation";

/** Single-user app: credentials come from environment variables. */
export default function SignUpPage() {
  redirect("/signin");
}
