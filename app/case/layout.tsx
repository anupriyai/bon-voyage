import type { ReactNode } from "react";
import CaseShell from "@/domains/case/components/CaseShell";

export default function CaseLayout({ children }: { children: ReactNode }) {
  return <CaseShell>{children}</CaseShell>;
}
