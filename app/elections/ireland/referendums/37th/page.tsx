export const dynamic = "force-dynamic";

import ReferendumPage from "@/components/ReferendumPage";

export default function Page() {
  return (
    <ReferendumPage
      title="37th Amendment Referendum"
      year="37th"
      country="ireland"
      type="referendums"
                  proposal={{
        title: "Proposal",
        text: "to remove the offence of publication or utterance of blasphemous matter from the Constitution."
      }}
    />
  );
}