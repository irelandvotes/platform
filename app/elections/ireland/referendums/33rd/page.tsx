export const dynamic = "force-dynamic";

import ReferendumPage from "@/components/ReferendumPage";

export default function Page() {
  return (
    <ReferendumPage
      title="33rd Amendment Referendum"
      year="33rd"
      country="ireland"
      type="referendums"
                  proposal={{
        title: "Proposal",
        text: "to mandate a new Court of Appeal above the High Court and below the Supreme Court"
      }}
    />
  );
}