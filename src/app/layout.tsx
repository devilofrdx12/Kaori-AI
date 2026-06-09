import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kaori AI — Your Intelligent Assistant",
  description: "A premium AI chat experience powered by Kaori. Search the web, generate documents, analyze code, and more.",
  keywords: ["Kaori", "AI", "Chat", "Assistant", "Anthropic"],
  authors: [{ name: "Kaori AI App" }],
  openGraph: {
    title: "Kaori AI — Your Intelligent Assistant",
    description: "A premium AI chat experience powered by Kaori.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script src="/live2dcubismcore.min.js"></script>
      </head>
      <body className="dark">
        {children}
      </body>
    </html>
  );
}
