import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset America",
  description: "Hit the button. Reset America.",
};

export default function ResetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
