"use client";

import dynamic from "next/dynamic";

const AdminCharts = dynamic(
  () => import("./charts").then((mod) => mod.AdminCharts),
  { ssr: false }
);

export function AdminChartsLoader(props: any) {
  return <AdminCharts {...props} />;
}
