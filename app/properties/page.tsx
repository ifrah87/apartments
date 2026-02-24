import { listPropertySummaries } from "@/lib/repos/propertiesRepo";
import PropertiesClient from "./PropertiesClient";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const summaries = await listPropertySummaries();
  return <PropertiesClient summaries={summaries} />;
}
