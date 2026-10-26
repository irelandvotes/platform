import { redirect } from "next/navigation";

export default function LegacyPollingGraphicRoute() {
  redirect("/staff/tools/polling-graphics/create");
}
