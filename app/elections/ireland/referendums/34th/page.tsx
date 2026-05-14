export const dynamic = "force-dynamic";

import ReferendumPage from "@/components/ReferendumPage";

export default function Page() {
  return (
    <ReferendumPage
      title="34th Amendment Referendum"
      year="34th"
      country="ireland"
      type="referendums"
                  proposal={{
        title: "Proposal",
        text: "to prohibit restriction on civil marriage based on sex"
      }}
    />
  );
}