/*

Author : Rajveer Sharma
Date : 14 Nov 2026
@ Nxtwave

*/

import {
  BookOpen,
  CalendarCheck,
  ChartColumn,
  ClipboardList,
  House,
  IdCard,
  Megaphone,
  MessageCircle,
  Trophy,
  Users,
  type LucideProps,
} from "lucide-react";
import type { NavIcon as NavIconName } from "@/common/lib/nav";

const ICONS = {
  home: House,
  students: Users,
  attendance: CalendarCheck,
  interactions: MessageCircle,
  tests: ClipboardList,
  contests: Trophy,
  curriculum: BookOpen,
  messages: Megaphone,
  staff: IdCard,
  analytics: ChartColumn,
} satisfies Record<NavIconName, React.ComponentType<LucideProps>>;

export function NavIcon({ name, ...props }: { name: NavIconName } & LucideProps) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" strokeWidth={1.8} {...props} />;
}
