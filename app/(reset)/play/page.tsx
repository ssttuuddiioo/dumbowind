import { PlayApp } from "@/components/reset/PlayApp";

// Phone view. ?s=SESSION pairs with a kiosk screen; without it, it's the online version.
export default function PlayPage({ searchParams }: { searchParams: { s?: string; b?: string } }) {
  const s = searchParams.s && /^[a-z0-9]{6,32}$/.test(searchParams.s) ? searchParams.s : null;
  return <PlayApp session={s} phoneButton={searchParams.b === "1"} />;
}
