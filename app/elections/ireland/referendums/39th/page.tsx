export const dynamic = "force-dynamic";

import ReferendumPage from "@/components/ReferendumPage";

export default function Page() {
  return (
    <ReferendumPage
      title="39th Amendment Referendum"
      year="39th"
      country="ireland"
      type="referendums"
            proposal={{
        title: "Proposal",
        text: "to expand recognition of the family to include durable relationships."
      }}
    />
  );
}