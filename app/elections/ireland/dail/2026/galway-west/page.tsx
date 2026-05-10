export const dynamic = "force-dynamic";

import DailByElectionPage from "@/components/DailByElectionPage";

export default function Page() {
  return (
    <DailByElectionPage
      title="Galway West By-Election 2026"
      year="2026"
      country="ireland"
      type="dail"
      slug="galway-west"
    />
  );
}