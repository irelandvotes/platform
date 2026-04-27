import { buildElectionRows } from "@/lib/buildElectionRows";
import ElectionsHubClient from "./ElectionsHubClient";

export default function ElectionsPage() {
  const rows = buildElectionRows();

  return (
    <ElectionsHubClient rows={rows} />
  );
}