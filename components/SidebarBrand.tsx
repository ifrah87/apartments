import Image from "next/image";

export function SidebarBrand() {
  return (
    <div className="flex items-center gap-3 px-4 py-5">
      <div className="shrink-0 rounded-xl bg-[#0B1220] ring-1 ring-white/10 p-2">
        <Image
          src="/logos/orfane-ro-mark.svg"
          alt="Orfane Real Estate"
          width={34}
          height={34}
          priority
        />
      </div>

      <div className="min-w-0 leading-none">
        <div className="truncate text-[14px] font-semibold tracking-wide text-white">
          ORFANE
        </div>
        <div className="truncate text-[10px] font-semibold tracking-[0.22em] text-cyan-300">
          REAL ESTATE
        </div>
      </div>
    </div>
  );
}
