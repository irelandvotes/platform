export const dynamic = "force-dynamic";

import ReferendumPage from "@/components/ReferendumPage";

export default function Page() {
  return (
    <ReferendumPage
      title="40th Amendment Referendum"
      year="40th"
      country="ireland"
      type="referendums"
      proposal={{
        title: "Proposal",
        text: "to remove reference to a woman's life within the home and mothers' duties in the home, and to insert a new provision on care within the family."
      }}
    />
  );
}