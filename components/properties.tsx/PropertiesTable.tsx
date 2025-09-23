import link from 'next/link';

type Row = {
    id: string;
    address: string;
    city: string;
    tenants: number | string;
    dueDate: string;
    rentDue: number | string;
    status: "VACANT" | "OCCUPIED";
};

export default function PropertiesTable({ rows }: { rows: Row[] }) {
    return (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <Th>ADDRESS</Th>
            <Th>TENANTS</Th>
            <Th>DUE DATE</Th>
            <Th>RENT DUE</Th>
            <Th>STATUS</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <Td>
                <Link
                  href={`/properties/${r.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {r.address.split(" — ")[0].toLowerCase()}
                </Link>
                <div className="text-xs text-slate-500">
                  {r.city.toLowerCase()}
                </div>
              </Td>
              <Td>{r.tenants}</Td>
              <Td>{r.dueDate}</Td>
              <Td>£{r.rentDue.toFixed(2)}</Td>
              <Td>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${
                    r.status === "VACANT"
                      ? "bg-slate-100 text-slate-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {r.status.toLowerCase()}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* footer (rows per page / pagination placeholder) */}
      <div className="flex items-center justify-between bg-white px-4 py-3 text-xs text-slate-500">
        <div>
          Rows per page:{" "}
          <select className="rounded border border-slate-200 bg-white px-2 py-1">
            <option>100</option>
            <option>50</option>
            <option>25</option>
          </select>
        </div>
        <div>1–{rows.length} of {rows.length}</div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
    return <th className= "px-4 py-3 text-xs font-semibold tracking-wider"> {children} </th>;
}

function Td({ children }: { children: React.ReactNode }) {
    return <td className= "px-4 py-3"> {children} </td>;
}