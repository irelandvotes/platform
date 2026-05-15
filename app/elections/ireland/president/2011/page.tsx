export const dynamic = "force-dynamic";

import PresidentialElectionPage from "@/components/PresidentialElectionPage";

export default function Page() {
  return (
    <PresidentialElectionPage
      title="President 2011"
      year="2011"
      country="ireland"
      type="president"
    />
  );
}