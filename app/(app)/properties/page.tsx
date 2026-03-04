import { listPropertySummaries } from "@/lib/repos/propertiesRepo";
import PropertiesClient from "./PropertiesClient";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  try {
    const summaries = await listPropertySummaries();
    return <PropertiesClient summaries={summaries} />;
  } catch (err) {
    console.error("Failed to load property summaries", err);
    return (
      <PropertiesClient
        summaries={[]}
        initialNotice="We couldn't load properties right now. Please try again shortly."
      />
    );
  }
}
