import {
  BarChart3,
  BedDouble,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  Map,
  Receipt,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Role = "admin" | "agent";
export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; mobile?: boolean };

export const NAV: Record<Role, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, mobile: true },
    { href: "/admin/agents", label: "Agents", icon: Building2, mobile: true },
    { href: "/admin/hotels", label: "Hotels", icon: BedDouble, mobile: true },
    { href: "/admin/trips", label: "Trips", icon: Map, mobile: true },
    { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/admin/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: Receipt },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ],
  agent: [
    { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true, mobile: true },
    { href: "/app/trips", label: "Trips", icon: Map, mobile: true },
    { href: "/app/guests", label: "Guests", icon: Users, mobile: true },
    { href: "/app/hotels", label: "Hotels", icon: BedDouble },
    { href: "/app/calendar", label: "Calendar", icon: CalendarDays, mobile: true },
    { href: "/app/documents", label: "Documents", icon: FileText },
    { href: "/app/payments", label: "Payments", icon: CreditCard },
    { href: "/app/reports", label: "Reports", icon: BarChart3 },
    { href: "/app/settings", label: "Settings", icon: Settings },
  ],
};

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}
