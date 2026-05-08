export const dynamic = "force-dynamic";

import DailByElectionPage from "@/components/DailByElectionPage";

export default function Page() {
  return (
    <DailByElectionPage
      title="Wexford By-Election 2019"
      year="2019"
      country="ireland"
      type="dail"
      slug="wexford"
    />
  );
}