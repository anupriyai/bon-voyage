"use client";

import Link from "next/link";
import { useCase } from "@/lib/store";

export default function HeaderCaseLink() {
  const { state, ready } = useCase();
  if (!ready || !state.complete) return null;
  return (
    <Link href="/case/about" className="login-link">
      My case
    </Link>
  );
}
