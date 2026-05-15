export const dynamic = "force-dynamic";

import PresidentialElectionPage from "@/components/PresidentialElectionPage";

export default function Page() {
  return (
    <PresidentialElectionPage
      title="President 2018"
      year="2018"
      country="ireland"
      type="president"
    />
  );
}