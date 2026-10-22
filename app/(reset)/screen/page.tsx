import { ScreenApp } from "@/components/reset/ScreenApp";

// Kiosk view. Add ?b=1 to let the paired phone show its own RESET button.
export default function ScreenPage({ searchParams }: { searchParams: { b?: string } }) {
  return <ScreenApp phoneButton={searchParams.b === "1"} />;
}
