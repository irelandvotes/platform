import PollPage from "../../../../components/PollPage";

export default function Page() {
  return (
    <PollPage
      country="ireland"
      election="dail"

      governmentApproval={{
        approval: 34,
        disapproval: 52,
        undecided: 14,
        title: "Government"
      }}
    />
  );
}