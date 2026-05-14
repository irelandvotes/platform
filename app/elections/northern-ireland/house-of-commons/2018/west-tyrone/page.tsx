export const dynamic = "force-dynamic";

import DailByElectionPage from "@/components/DailByElectionPage";

export default function Page() {
  return (
    <DailByElectionPage
      title="West Tyrone By-Election 2018"
      year="2018"
      country="northern-ireland"
      type="house-of-commons"
      slug="west-tyrone"
    />
  );
}