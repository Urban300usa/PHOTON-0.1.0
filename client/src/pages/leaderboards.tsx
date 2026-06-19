import { PageHeader } from "@/components/PageHeader";
import Leaderboard from "@/components/Leaderboard";
import { Trophy } from "lucide-react";

export default function LeaderboardsPage() {
  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <PageHeader
        icon={Trophy}
        title="Leaderboards"
        subtitle="Compete with other pilots — create or join a board and climb the ranks"
      />
      <Leaderboard />
    </div>
  );
}
