export const dynamic = "force-dynamic";

import ElectionPage from "@/components/ElectionPage";

export default function eu2024() {
  return (
    <ElectionPage
      title="European Parliament 2024"
      year="2024"
      country="ireland"
      type="european"
    />
  );
}