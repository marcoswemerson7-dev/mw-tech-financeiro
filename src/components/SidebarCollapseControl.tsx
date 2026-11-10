import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "mw-tech:sidebar-collapsed";
const EXPANDED_WIDTH = 254;
const COLLAPSED_WIDTH = 80;

export default function SidebarCollapseControl() {
  const location = useLocation();
  // Start expanded after correcting the previously broken collapsed layout.
  const [collapsed, setCollapsed] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const sidebar = document.getElementById("app-sidebar") as HTMLElement | null;
    const shell = document.querySelector<HTMLElement>(".app-content-shell");
    const logo = sidebar?.firstElementChild as HTMLElement | null;
    setTarget(logo || null);
    if (!sidebar || !shell) return;

    const apply = () => {
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      const compact = desktop && collapsed;
      document.body.classList.toggle("mw-sidebar-collapsed", compact);
      if (desktop) {
        sidebar.style.setProperty("width", `${compact ? COLLAPSED_WIDTH : EXPANDED_WIDTH}px`, "important");
        shell.style.setProperty("padding-left", `${compact ? COLLAPSED_WIDTH : EXPANDED_WIDTH}px`, "important");
        sidebar.style.setProperty("overflow-x", "hidden", "important");
        sidebar.style.setProperty("transition", "width 180ms ease", "important");
        shell.style.setProperty("transition", "padding-left 180ms ease", "important");
      } else {
        sidebar.style.removeProperty("width");
        sidebar.style.removeProperty("overflow-x");
        sidebar.style.removeProperty("transition");
        shell.style.removeProperty("padding-left");
        shell.style.removeProperty("transition");
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      document.body.classList.remove("mw-sidebar-collapsed");
      sidebar.style.removeProperty("width");
      sidebar.style.removeProperty("overflow-x");
      sidebar.style.removeProperty("transition");
      shell.style.removeProperty("padding-left");
      shell.style.removeProperty("transition");
    };
  }, [collapsed, location.pathname]);

  if (location.pathname === "/login" || location.pathname.startsWith("/central-")) return null;
  const toggle = (
    <button
      type="button"
      onClick={() => {
        setCollapsed(value => {
          const next = !value;
          try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* optional */ }
          return next;
        });
      }}
      className="absolute bottom-3 right-3 z-50 hidden h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white shadow-lg hover:bg-white/20 lg:flex"
      aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
    >
      {collapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
    </button>
  );

  return (
    <>
      <style>{`
        @media (min-width:1024px) {
          body.mw-sidebar-collapsed #app-sidebar > div:first-child {
            min-height:112px !important;
            padding:8px !important;
          }
          body.mw-sidebar-collapsed #app-sidebar > div:first-child img {
            width:62px !important;
            height:74px !important;
          }
          body.mw-sidebar-collapsed #app-sidebar > nav {
            padding-left:7px !important;
            padding-right:7px !important;
          }
          body.mw-sidebar-collapsed #app-sidebar > nav > a,
          body.mw-sidebar-collapsed #app-sidebar > nav > div > button {
            min-width:0 !important;
            width:100% !important;
            justify-content:center !important;
            gap:0 !important;
            padding-left:0 !important;
            padding-right:0 !important;
            font-size:0 !important;
          }
          body.mw-sidebar-collapsed #app-sidebar > nav > a > span,
          body.mw-sidebar-collapsed #app-sidebar > nav > div > button > span,
          body.mw-sidebar-collapsed #app-sidebar > nav > div > button > svg:last-child {
            display:none !important;
          }
          body.mw-sidebar-collapsed #app-sidebar > nav > div > div[id^="sidebar-section-"] {
            display:none !important;
          }
          body.mw-sidebar-collapsed #app-sidebar > nav svg {
            display:block !important;
            flex:none !important;
          }
          body.mw-sidebar-collapsed #app-sidebar > button:last-child {
            justify-content:center !important;
            padding:0 !important;
            font-size:0 !important;
            gap:0 !important;
          }
          body.mw-sidebar-collapsed #app-sidebar > div:first-child button[aria-label*="barra lateral"] {
            right:7px !important;
            bottom:6px !important;
          }
        }
      `}</style>
      {target ? createPortal(toggle, target) : null}
    </>
  );
}
