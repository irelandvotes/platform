export const dynamic = "force-dynamic";

import ReferendumPage from "@/components/ReferendumPage";

export default function Page() {
  return (
    <ReferendumPage
      title="EU Membership Referendum"
      year="2016"
      country="northern-ireland"
      type="referendums"
                  proposal={{
        title: "Question",
        text: "Should the United Kingdom remain a member of the European Union or leave the European Union?"
      }}
    />
  );
}