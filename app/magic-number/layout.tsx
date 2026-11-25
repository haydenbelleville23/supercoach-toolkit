import { hideInternalPageInProduction } from "@/lib/internalPages";

export default function MagicNumberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  hideInternalPageInProduction();

  return children;
}
