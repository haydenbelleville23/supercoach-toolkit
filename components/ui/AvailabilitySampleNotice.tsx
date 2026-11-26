import { availabilitySnapshot } from "@/lib/availability/snapshot";

/**
 * "Sample status data" label, shown wherever badges appear while the
 * debug lock loads the invented sample. Nothing otherwise.
 */
export default function AvailabilitySampleNotice({
  snapshot = availabilitySnapshot,
  className = "",
}: {
  snapshot?: { sample?: boolean } | null;
  className?: string;
}) {
  if (!snapshot?.sample) return null;

  return (
    <p
      role="note"
      className={`inline-flex items-center gap-1.5 rounded-md border border-dashed border-amber-400/60 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ${className}`}
    >
      Sample status data (invented, for testing)
    </p>
  );
}
