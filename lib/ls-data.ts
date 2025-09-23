import { prisma } from "./db";

export async function getDashboardMock() {
  const [row] = await prisma.$queryRaw<{ now: Date }[]>`SELECT now()`;
  console.log("✅ Connected to DB, current time:", row.now);

  return {
    kpis: {
      rentReceived: 0,
      upcoming: 0,
      overdue:0,
      cashIn: 0,
      cashOut: 0,
      net: 0,
    },

    series: [],
    properties: { total: 0, units: 0, single: 0 },
    occupancy: 0,
  };
}