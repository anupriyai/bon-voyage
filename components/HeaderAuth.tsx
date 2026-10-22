"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCase } from "@/lib/store";

/** Log in / My cases / Log out. "My cases" only appears once someone is signed in. */
export default function HeaderAuth() {
  const { ready, session, logout } = useCase();
  const router = useRouter();
  if (!ready) return null;

  if (!session) {
    return (
      <Link href="/login" className="login-link">
        Log in
      </Link>
    );
  }
  return (
    <>
      <Link href="/account" className="login-link">
        My cases
      </Link>
      <button
        type="button"
        className="login-link link-plain"
        onClick={() => {
          logout();
          router.push("/");
        }}
      >
        Log out
      </button>
    </>
  );
}
