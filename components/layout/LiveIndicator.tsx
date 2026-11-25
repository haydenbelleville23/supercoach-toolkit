/** Small note shown only while live scores are feeding into prices. */
export default function LiveIndicator({
  className = "",
}: {
  className?: string;
}) {
  return (
    <p
      role="status"
      className={`flex items-center gap-1.5 text-xs font-medium text-emerald-400 ${className}`}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"
      />
      Live: prices update as games finish
    </p>
  );
}
