import { redirect } from "next/navigation";

type SearchParams = {
  [key: string]: string | string[] | undefined;
};

function buildQuery(searchParams: SearchParams) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string") params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default function ReportsTransactionsRedirect({ searchParams }: { searchParams: SearchParams }) {
  redirect(`/reports/account-transactions${buildQuery(searchParams)}`);
}
