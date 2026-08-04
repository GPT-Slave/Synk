import { DashboardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-svh px-5 sm:px-8">
      <DashboardSkeleton />
    </main>
  );
}
