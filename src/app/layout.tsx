import type { Metadata } from "next";
import "./globals.css";
import { SolanaProvider } from "@/context/solanaProvider";



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
      <body
        className={`antialiased`}
      >
        <SolanaProvider>
          {children}
        </SolanaProvider>
      </body>
    </html>
  );
}
