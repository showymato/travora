import { Instrument_Serif } from "next/font/google";
import { MotionRoot } from "@/components/marketing/motion";
import "./landing.css";

// Editorial serif for marketing headlines only; the product UI stays on Geist.
const editorial = Instrument_Serif({ variable: "--font-editorial", weight: "400", style: ["normal", "italic"], subsets: ["latin"] });

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`lp ${editorial.variable}`}>
      <MotionRoot />
      {children}
    </div>
  );
}
