import { hideInternalPageInProduction } from "@/lib/internalPages";

export default function DebugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  hideInternalPageInProduction();

  return children;
}
