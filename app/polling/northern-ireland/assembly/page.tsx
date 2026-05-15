import PollPage from "@/components/PollPage";

export default function Page() {

return (

<PollPage
country="northern-ireland"
election="assembly"
tracker="ni"

      governmentApproval={{
        approval: 11,
        disapproval: 57,
        undecided: 32,
        title: "Government"
      }}
/>

);

}