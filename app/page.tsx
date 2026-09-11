import { Suspense } from "react"
import { auth } from "@/auth" // Adjust this path if your auth.ts is elsewhere
import HomeContent from "./components/HomeContent"
import LandingPage from "./landing/LandingPage"

export default async function Page() {
  const session = await auth()

  // Show the landing page first if the user is not logged in
  if (!session) {
    return <LandingPage />
  }

  // Otherwise, show the main app content
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}