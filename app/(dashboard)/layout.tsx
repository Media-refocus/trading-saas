import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Navigation from "@/components/navigation";
import { checkAndUpdateExpiredTrial } from "@/lib/plan-gates";
import { UpgradeRequired } from "./upgrade-required";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Check subscription status and auto-pause expired trials
  const subscriptionInfo = await checkAndUpdateExpiredTrial(session.user.tenantId);

  // If subscription is paused/canceled, show upgrade page instead of dashboard
  if (subscriptionInfo.status === "PAUSED" || subscriptionInfo.status === "CANCELED") {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <UpgradeRequired status={subscriptionInfo.status} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
