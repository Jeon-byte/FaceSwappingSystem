import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "基于扩散模型的智能换脸系统",
  description: "From ComfyUI to beatiful web apps",
};

import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </body>
      </html>
    </>
  )
}
