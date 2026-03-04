"use server";

import { query } from "@/lib/db";

export async function adminDeleteProperty(id: string) {
  if (!id) {
    throw new Error("Property id is required.");
  }
  await query(`DELETE FROM properties WHERE id = $1`, [id]);
}
