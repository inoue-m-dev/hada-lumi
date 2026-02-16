import { notFound } from "next/navigation";
import DebugIdTokenClient from "./DebugIdTokenClient";

export default function DebugIdTokenPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <DebugIdTokenClient />;
}
