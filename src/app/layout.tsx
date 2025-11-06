import type { Metadata } from "next";
import "./globals.css";
import { SolanaProvider } from "@/context/solanaProvider";
import { Gruppo, Michroma } from "next/font/google";

const gruppo = Gruppo({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-gruppo",
});

const michroma = Michroma({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-michroma",
});

export const metadata: Metadata = {
  title: "AssureFund",
  description: "Funding on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${gruppo.className} antialiased`}>
        <SolanaProvider>{children}</SolanaProvider>
      </body>
    </html>
  );
}
