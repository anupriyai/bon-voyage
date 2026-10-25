import type { ReactNode } from "react";
import CaseShell from "@/components/bv/CaseShell";

export default function CaseLayout({ children }: { children: ReactNode }) {
  return <CaseShell>{children}</CaseShell>;
}
