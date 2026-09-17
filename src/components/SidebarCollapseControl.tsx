import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "mw-tech:sidebar-collapsed";

export default function SidebarCollapseControl() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  useEffect(() => {
    document.body.classList.toggle("mw-sidebar-collapsed", collapsed);
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    return () => document.body.classList.remove("mw-sidebar-collapsed");
  }, [collapsed]);

  if (location.pathname === "/login") return null;

  return (
    <>
      <style>{`
        @media (min-width: 1024px) {
          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 {
            width: 86px !important;
            overflow-x: hidden !important;
            transition: width .28s ease !important;
          }

          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 ~ div {
            padding-left: 86px !important;
            transition: padding-left .28s ease !important;
          }

          body:not(.mw-sidebar-collapsed) aside.fixed.inset-y-0.left-0 ~ div {
            transition: padding-left .28s ease !important;
          }

          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 > div:first-child {
            min-height: 112px !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
          }

          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 > div:first-child img {
            width: 68px !important;
            height: 82px !important;
          }

          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 nav a,
          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 nav > div > div:first-child {
            justify-content: center !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
            font-size: 0 !important;
            gap: 0 !important;
          }

          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 nav a span,
          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 nav > div > div:first-child span,
          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 nav > div > div:first-child svg:last-child {
            display: none !important;
          }

          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 nav > div > div:nth-child(2) {
            display: none !important;
          }

          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 > div:nth-last-of-type(1) {
            display: none !important;
          }

          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 > button:last-child {
            justify-content: center !important;
            font-size: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
        }
      `}</style>

      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="fixed top-[92px] z-50 hidden size-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_6px_18px_rgba(7,24,45,.18)] transition-all duration-300 hover:bg-slate-50 lg:grid"
        style={{ left: collapsed ? 70 : 238 }}
        title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </>
  );
}
