export const dynamic = "force-dynamic";

import ElectionPage from "@/components/ElectionPage";

export default function hoc2017() {
  return (
    <ElectionPage
      title="House of Commons 2017"
      year="2017"
      country="northern-ireland"
      type="house-of-commons"
    />
  );
}