import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { ChatLauncher } from "@/components/chat/chat-launcher";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "LiLearn — AI Adaptive Study Planner",
    template: "%s | LiLearn",
  },
  description:
    "AI-powered study planner with adaptive quizzes, personalized study plans, and habit tracking. Study smarter, not harder.",
  keywords: [
    "study planner",
    "AI quiz",
    "adaptive learning",
    "habit tracking",
    "student tools",
  ],
  openGraph: {
    title: "LiLearn — AI Adaptive Study Planner",
    description:
      "AI-powered study planner with adaptive quizzes, personalized study plans, and habit tracking.",
    type: "website",
  },
};

const inter = Inter({
  variable: "--font-inter",
  display: "swap",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-display",
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${dmSans.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <ChatLauncher />
        </ThemeProvider>
      </body>
    </html>
  );
}
