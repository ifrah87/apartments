"use client";

import React from "react";

export default function TopbarLS(): JSX.Element {
  return (
    <div className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center justify-end px-4">
      <div className="flex items-center gap-2 pl-3 border-l">
        <div className="h-8 w-8 rounded-full bg-emerald-500 text-white grid place-items-center text-sm font-semibold">Js</div>
        <div className="text-sm text-slate-700">Ifrah Awaale</div>
      </div>
    </div>
  );
}
