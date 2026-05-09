export const dynamic = "force-dynamic";

import DailByElectionPage from "@/components/DailByElectionPage";

export default function Page() {
  return (
    <DailByElectionPage
      title="Meath East By-Election 2013"
      year="2013"
      country="ireland"
      type="dail"
      slug="meath-east"
    />
  );
}