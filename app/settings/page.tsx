import Link from "next/link";
import { Settings, Building2, Landmark, CreditCard, Layers, Gauge, Wallet, Users } from "lucide-react";
import SectionCard from "@/components/ui/SectionCard";

const SETTINGS_CARDS = [
  {
    title: "General Info",
    description: "Manage your organization details.",
    icon: Settings,
    href: "/settings/general",
  },
  {
    title: "Logo & Branding",
    description: "Update your brand identity.",
    icon: Layers,
    href: "/settings/branding",
  },
  {
    title: "Bank Info",
    description: "Payment instructions for tenants.",
    icon: Landmark,
    href: "/settings/bank",
  },
  {
    title: "Property Types",
    description: "Categorize units (e.g. Residence).",
    icon: Building2,
    href: "/settings/property-types",
  },
  {
    title: "Payment Methods",
    description: "Accept Cash, Bank, Mobile App.",
    icon: CreditCard,
    href: "/settings/payment-methods",
  },
  {
    title: "Initial Readings",
    description: "Set baseline meter values.",
    icon: Gauge,
    href: "/settings/initial-readings",
  },
  {
    title: "Expense Accounts",
    description: "Manage expense and purchases accounts.",
    icon: Wallet,
    href: "/settings/expense-categories",
  },
  {
    title: "Team Management",
    description: "Manage access roles for Admin and Customer Service staff.",
    icon: Users,
    href: "/admin/settings",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-slate-100">
          <Settings className="h-5 w-5 text-accent" />
          <h1 className="text-2xl font-semibold">System Settings</h1>
        </div>
        <p className="text-sm text-slate-400">
          Configure your property management platform to suit your business needs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="group">
              <SectionCard className="flex items-center gap-4 p-4 transition hover:border-white/20 hover:bg-white/5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">{card.title}</h2>
                  <p className="text-xs text-slate-400">{card.description}</p>
                </div>
              </SectionCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
