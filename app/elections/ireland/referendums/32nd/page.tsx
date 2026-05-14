export const dynamic = "force-dynamic";

import ReferendumPage from "@/components/ReferendumPage";

export default function Page() {
  return (
    <ReferendumPage
      title="32nd Amendment Referendum"
      year="32nd"
      country="ireland"
      type="referendums"
                  proposal={{
        title: "Proposal",
        text: "to abolish Seanad Éireann, the upper house of the Oireachtas"
      }}
    />
  );
}