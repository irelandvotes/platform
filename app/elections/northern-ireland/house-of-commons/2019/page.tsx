export const dynamic = "force-dynamic";

import ElectionPage from "@/components/ElectionPage";

export default function hoc2019() {
  return (
    <ElectionPage
      title="House of Commons 2019"
      year="2019"
      country="northern-ireland"
      type="house-of-commons"
    />
  );
}