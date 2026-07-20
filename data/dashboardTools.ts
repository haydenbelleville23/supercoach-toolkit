import {
  ArrowRightLeft,
  PiggyBank,
  TrendingUp,
  Trophy,
} from "lucide-react";

export const dashboardTools = [
  {
    title: "Price Projector",
    description:
      "Project AFL Fantasy price changes from your expected scores.",
    href: "/projector",
    status: "Available",
    icon: TrendingUp,
  },
  {
    title: "Cash Cows",
    description:
      "Find the best cash generators and compare projected price rises.",
    href: "/cash-cows",
    status: "Available",
    icon: PiggyBank,
  },
  {
    title: "Live Scores",
    description:
      "Follow live fantasy scoring throughout every AFL match.",
    href: "/live",
    status: "Available",
    icon: Trophy,
  },
  {
    title: "Trade Planner",
    description:
      "Plan upgrades, downgrades and maximise your salary cap.",
    href: "#",
    status: "Coming Soon",
    icon: ArrowRightLeft,
  },
];
