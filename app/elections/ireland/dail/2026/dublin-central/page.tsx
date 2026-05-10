export const dynamic = "force-dynamic";

import DailByElectionPage from "@/components/DailByElectionPage";

export default function Page() {
  return (
    <DailByElectionPage
      title="Dublin Central By-Election 2026"
      year="2026"
      country="ireland"
      type="dail"
      slug="dublin-central"
    />
  );
}