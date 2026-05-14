export const dynamic = "force-dynamic";

import ElectionPage from "@/components/ElectionPage";

export default function hoc2015() {
  return (
    <ElectionPage
      title="House of Commons 2015"
      year="2015"
      country="northern-ireland"
      type="house-of-commons"
    />
  );
}