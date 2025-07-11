import "./globals.css"
import { Analytics } from "@vercel/analytics/next"

export const metadata = {
  title: "TaskMaster AI - Intelligent Task Management",
  description:
    "Advanced AI-powered task management with Google Gemini integration. Smart task suggestions, categorization, and productivity coaching. Voice commands and intelligent planning.",
  keywords: "todo, task manager, AI assistant, Google Gemini, voice commands, productivity, smart suggestions",
  authors: [{ name: "TaskMaster AI Team" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
    generator: 'v0.dev'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' fontSize='90'>🤖</text></svg>"
        />
      </head>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
