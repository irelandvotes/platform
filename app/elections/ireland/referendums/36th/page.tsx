export const dynamic = "force-dynamic";

import ReferendumPage from "@/components/ReferendumPage";

export default function Page() {
  return (
    <ReferendumPage
      title="36th Amendment Referendum"
      year="36th"
      country="ireland"
      type="referendums"
                  proposal={{
        title: "Proposal",
        text: "to remove clauses added by the 8th, 13th, and 14th Amendments of the Constitution and allowed the Oireachtas to legislate for the regulation of termination of pregnancy."
      }}
    />
  );
}