// The Collabgram logo (icon + wordmark), from the brand files.
import Image from "next/image";

export default function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  return <Image src="/brand/logo.png" alt="Collabgram" width={517} height={116} priority className={className} />;
}
