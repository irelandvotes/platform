export const dynamic = "force-dynamic";

import DailByElectionPage from "@/components/DailByElectionPage";

export default function Page() {
  return (
    <DailByElectionPage
      title="Carlow-Kilkenny By-Election 2015"
      year="2015"
      country="ireland"
      type="dail"
      slug="carlow-kilkenny"
    />
  );
}