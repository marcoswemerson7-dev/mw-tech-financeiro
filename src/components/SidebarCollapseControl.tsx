import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "mw-tech:sidebar-collapsed";
const EXPANDED = 254;
const COLLAPSED = 86;

export default function SidebarCollapseControl() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");

    const applyLayout = () => {
      const sidebar = document.querySelector<HTMLElement>("aside.fixed.inset-y-0.left-0");
      const appHeader = document.querySelector<HTMLElement>("header.sticky.top-0");
      const shell = appHeader?.parentElement as HTMLElement | null;
      const logoArea = sidebar?.firstElementChild as HTMLElement | null;
      const desktop = window.matchMedia("(min-width: 1024px)").matches;

      setPortalTarget(logoArea || null);

      if (!sidebar || !shell) return;

      if (!desktop) {
        sidebar.style.removeProperty("width");
        sidebar.style.removeProperty("overflow-x");
        sidebar.style.removeProperty("transition");
        shell.style.removeProperty("padding-left");
        shell.style.removeProperty("transition");
        document.body.classList.remove("mw-sidebar-collapsed");
        return;
      }

      const width = collapsed ? COLLAPSED : EXPANDED;
      sidebar.style.setProperty("width", `${width}px`, "important");
      sidebar.style.setProperty("overflow-x", "hidden", "important");
      sidebar.style.setProperty("transition", "width 220ms ease", "important");
      shell.style.setProperty("padding-left", `${width}px`, "important");
      shell.style.setProperty("transition", "padding-left 220ms ease", "important");
      document.body.classList.toggle("mw-sidebar-collapsed", collapsed);
    };

    applyLayout();
    const raf = window.requestAnimationFrame(applyLayout);
    const timer = window.setTimeout(applyLayout, 250);
    const observer = new MutationObserver(applyLayout);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", applyLayout);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", applyLayout);
    };
  }, [collapsed, location.pathname]);

  if (location.pathname === "/login") return null;

  const button = (
    <button
      type="button"
      onClick={() => setCollapsed((value) => !value)}
      className="absolute bottom-3 right-3 z-50 hidden size-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-white shadow-[0_8px_20px_rgba(0,0,0,.20)] backdrop-blur-sm transition hover:bg-white/20 lg:grid"
      title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
    >
      {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
    </button>
  );

  return (
    <>
      <style>{`
        @media (min-width: 1024px) {
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
          body.mw-sidebar-collapsed aside.fixed.inset-y-0.left-0 > div:first-child button[aria-label*="menu lateral"] {
            bottom: 8px !important;
            right: 8px !important;
            width: 32px !important;
            height: 32px !important;
          }
        }
      `}</style>
      {portalTarget ? createPortal(button, portalTarget) : null}
    </>
  );
}
