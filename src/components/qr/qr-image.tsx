import { qrMatrix, qrPath } from "@/lib/qr/matrix";
import { cn } from "@/lib/utils";

/** A QR code as inline SVG (crisp at any size, no image request). */
export function QrImage({
  url,
  label,
  className,
}: {
  url: string;
  label: string;
  className?: string;
}) {
  const { d, viewBox } = qrPath(qrMatrix(url), 4);
  return (
    <svg
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={cn("shrink-0 rounded-lg bg-white", className)}
    >
      <rect width={viewBox} height={viewBox} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}
