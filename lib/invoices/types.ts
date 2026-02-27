export type InvoiceLineItem = {
  id: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
};

export type MeterSnapshot = {
  prevDate: string;
  prevReading: number;
  currDate: string;
  currReading: number;
  usage: number;
  rate: number;
  amount: number;
  unitLabel?: string;
};

export type InvoiceRecord = {
  id: string;
  line_items: InvoiceLineItem[];
  meter_snapshot: MeterSnapshot | null;
  total_amount: number | null;
};
