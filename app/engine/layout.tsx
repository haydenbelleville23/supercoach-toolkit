import { hideInternalPageInProduction } from "@/lib/internalPages";

export default function EngineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  hideInternalPageInProduction();

  return children;
}
