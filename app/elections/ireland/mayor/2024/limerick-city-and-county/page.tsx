export const dynamic = "force-dynamic";

import DailByElectionPage from "@/components/DailByElectionPage";

export default function Page() {
  return (
    <DailByElectionPage
      title="Mayor of Limerick City and County 2024"
      year="2024"
      country="ireland"
      type="mayor"
      slug="limerick-city-and-county"
    />
  );
}