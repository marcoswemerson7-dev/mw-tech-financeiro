import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "mw-tech:sidebar-collapsed";
const EXPANDED_WIDTH = 254;
const COLLAPSED_WIDTH = 86;

export default function SidebarCollapseControl() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  useEffect(() => {
    document.body.classList.toggle("mw-sidebar-collapsed", collapsed);
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");

    const syncLayout = () => {
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      const sidebar = document.querySelector<HTMLElement>("aside.fixed.inset-y-0.left-0");
      if (!sidebar) return;

      const layoutRoot = sidebar.parentElement;
      if (!layoutRoot) return;

      const mainShell = Array.from(layoutRoot.children).find((element) => {
        if (!(element instanceof HTMLElement) || element === sidebar) return false;
        return element.querySelector("header.sticky") !== null;
      }) as HTMLElement | undefined;

      if (!mainShell) return;

      if (desktop) {
        const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
        sidebar.style.width = `${width}px`;
        sidebar.style.transition = "width 220ms ease, transform 220ms ease";
        mainShell.style.paddingLeft = `${width}px`;
        mainShell.style.transition = "padding-left 220ms ease";
      } else {
        sidebar.style.width = "";
        mainShell.style.paddingLeft = "";
      }
    };

    syncLayout();
    const frame = window.requestAnimationFrame(syncLayout);
    const timer = window.setTimeout(syncLayout, 80);
    window.addEventListener("resize", syncLayout);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("resize", syncLayout);
      document.body.classList.remove("mw-sidebar-collapsed");
    };
  }, [collapsed, location.pathname]);

  if (location.pathname === "/login") return null;

  return (
    <>
      <style>{`
        @media (min-width: 1024px) {
          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 {
            width: 86px !important;
            overflow-x: hidden !important;
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
        className="fixed top-[92px] z-50 hidden size-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_6px_18px_rgba(7,24,45,.18)] transition-all duration-200 hover:bg-slate-50 lg:grid"
        style={{ left: collapsed ? COLLAPSED_WIDTH - 16 : EXPANDED_WIDTH - 16 }}
        title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </>
  );
}
