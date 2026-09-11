import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import AuthSessionProvider from "./components/SessionProvider"
import Navbar from "./components/Navbar"
import { auth } from "@/auth" // Import auth

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Triage",
  description: "GitHub Issues Finder",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Pass session to provider to avoid extra network requests on the client */}
        <AuthSessionProvider>
          {/* Only render the global Navbar if the user is logged in */}
          {session && <Navbar />}
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  )
}