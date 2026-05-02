export const dynamic = "force-dynamic";

import ElectionPage from "@/components/ElectionPage";

export default function hoc2024() {
  return (
    <ElectionPage
      title="House of Commons 2024"
      year="2024"
      country="northern-ireland"
      type="house-of-commons"
    />
  );
}