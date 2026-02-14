import Image from "next/image";

export function SidebarBrand() {
  return (
    <div className="flex items-center justify-center px-1 pb-0 pt-0 -mt-4">
      <div className="relative h-48 w-48">
        <Image
          src="/logos/orfane-logo-crop.png"
          alt="Orfane Real Estate"
          fill
          sizes="192px"
          className="object-contain object-bottom"
          priority
        />
      </div>
    </div>
  );
}
