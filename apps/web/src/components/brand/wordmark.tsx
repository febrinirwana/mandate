const ASPECT = 2172 / 724;

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="mandate"
      className={`inline-block bg-current ${className ?? ""}`}
      style={{
        aspectRatio: `${ASPECT}`,
        WebkitMaskImage: "url('/mandate-logo.png')",
        maskImage: "url('/mandate-logo.png')",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
