export const dynamic = "force-dynamic";

import DailByElectionPage from "@/components/DailByElectionPage";

export default function Page() {
  return (
    <DailByElectionPage
      title="Dublin Bay South By-Election 2021"
      year="2021"
      country="ireland"
      type="dail"
    />
  );
}