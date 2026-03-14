import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "../styles/globals.css"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "TURNABLE - 3D Sculpting Portfolio",
  description: "Interactive 3D sculpture gallery by Iver Finne",
  generator: "v0.app",
  metadataBase: new URL("https://turnable-db.vercel.app"), // Replace with your actual production URL
  openGraph: {
    title: "TURNABLE - 3D Sculpting Portfolio",
    description: "Interactive 3D sculpture gallery by Iver Finne",
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 630,
        alt: "TURNABLE Banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TURNABLE - 3D Sculpting Portfolio",
    description: "Interactive 3D sculpture gallery by Iver Finne",
    images: ["/banner.png"],
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>{children}</body>
    </html>
  )
}
