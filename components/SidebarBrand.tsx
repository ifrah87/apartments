"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchSettings } from "@/lib/settings/client";
import { DEFAULT_BRANDING, DEFAULT_GENERAL } from "@/lib/settings/defaults";
import type { BrandingSettings, GeneralSettings } from "@/lib/settings/types";

export function SidebarBrand() {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL);

  useEffect(() => {
    fetchSettings<BrandingSettings>("branding", DEFAULT_BRANDING).then(setBranding);
    fetchSettings<GeneralSettings>("general", DEFAULT_GENERAL).then(setGeneral);
  }, []);

  const logoPath = branding.logoPath || DEFAULT_BRANDING.logoPath;
  const altText = general.orgName || branding.appName || DEFAULT_GENERAL.orgName;

  return (
    <div className="flex items-center justify-center px-1 pb-0 pt-0 -mt-4">
      <div className="relative h-48 w-48">
        <Image
          src={logoPath}
          alt={altText}
          fill
          sizes="192px"
          className="object-contain object-bottom"
          priority
        />
      </div>
    </div>
  );
}
