import type { Metadata } from "next";
import Script from "next/script";
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
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- Runtime font picker needs all families available without build-time font fetching. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Poppins:wght@300;400;500;600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <Script src="/live2dcubismcore.min.js" strategy="beforeInteractive" />
        <Script
          id="kaori-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{__html: `
          (function() {
            try {
              var t = localStorage.getItem('kaori_theme');
              if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches) || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
              
              var a = localStorage.getItem('kaori_accent');
              if (a) {
                var colors = { blue: '217 91% 60%', purple: '270 95% 60%', pink: '330 81% 60%', green: '142 71% 45%', orange: '18 65% 59%', indigo: '239 84% 67%', black: '0 0% 10%' };
                var hsl = colors[a] || colors['orange'];
                document.documentElement.style.setProperty('--primary', hsl);
                document.documentElement.style.setProperty('--ring', hsl);
                document.documentElement.style.setProperty('--color-primary', 'hsl(' + hsl + ')');
              }
              
              var f = localStorage.getItem('kaori_font') || 'Kaori UI';
              if (f) {
                if (f === 'Kaori UI') {
                  document.documentElement.style.setProperty('--font-sans', '"Poppins", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
                  document.documentElement.style.setProperty('--font-assistant', '"Lora", "Playfair Display", Georgia, serif');
                } else {
                  document.documentElement.style.setProperty('--font-sans', '"' + f + '", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
                }
              }
            } catch(e) {}
          })();
        `}}
        />
      </head>
      <body className="bg-background text-on-surface font-body overflow-hidden transition-colors duration-300">
        <div className="fixed inset-0 pointer-events-none opacity-40"></div>
        {children}
      </body>
    </html>
  );
}
