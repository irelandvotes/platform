export const dynamic = "force-dynamic";

import ReferendumPage from "@/components/ReferendumPage";

export default function Page() {
  return (
    <ReferendumPage
      title="38th Amendment Referendum"
      year="38th"
      country="ireland"
      type="referendums"
                  proposal={{
        title: "Proposal",
        text: "to remove the requirement of a period of separation before proceedings for divorce are initiated, and to allow for recognition of foreign divorces."
      }}
    />
  );
}