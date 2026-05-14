export const dynamic = "force-dynamic";

import ReferendumPage from "@/components/ReferendumPage";

export default function Page() {
  return (
    <ReferendumPage
      title="35th Amendment Referendum"
      year="35th"
      country="ireland"
      type="referendums"
                  proposal={{
        title: "Proposal",
        text: "to lower the minimum age for the presidency from 35 to 21."
      }}
    />
  );
}