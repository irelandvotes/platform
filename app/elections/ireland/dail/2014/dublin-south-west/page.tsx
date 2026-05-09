export const dynamic = "force-dynamic";

import DailByElectionPage from "@/components/DailByElectionPage";

export default function Page() {
  return (
    <DailByElectionPage
      title="Dublin South-West By-Election 2014"
      year="2014"
      country="ireland"
      type="dail"
      slug="dublin-south-west"
    />
  );
}