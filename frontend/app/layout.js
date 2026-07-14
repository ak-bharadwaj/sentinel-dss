import { Fira_Code, Fira_Sans, Orbitron } from "next/font/google";
import "./globals.css";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  display: "swap",
});

export const metadata = {
  title: "Sentinel AMIS-RU | Disaster Response Command Console",
  description: "Adaptive Multi-Agent Intelligence System for Resource Allocation Under Uncertainty — Real-time flood rescue and disaster response coordination.",
  keywords: ["disaster response", "AMIS-RU", "rescue coordination", "flood simulation", "multi-agent systems"],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${firaSans.variable} ${firaCode.variable} ${orbitron.variable}`}>
      <body>{children}</body>
    </html>
  );
}
