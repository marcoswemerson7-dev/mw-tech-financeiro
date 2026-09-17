import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "mw-tech:sidebar-collapsed";
const EXPANDED = 254;
const COLLAPSED = 86;

export default function SidebarCollapseControl() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");

    const apply = () => {
      if (window.innerWidth < 1024) return;

      const sidebar = document.querySelector("aside.fixed.inset-y-0.left-0") as HTMLElement | null;
      const appHeader = document.querySelector("header.sticky.top-0") as HTMLElement | null;
      const shell = appHeader?.parentElement as HTMLElement | null;
      const width = collapsed ? COLLAPSED : EXPANDED;

      if (sidebar) {
        sidebar.style.width = `${width}px`;
        sidebar.style.transition = "width 220ms ease";
        sidebar.style.overflowX = "hidden";
      }

      if (shell) {
        shell.style.paddingLeft = `${width}px`;
        shell.style.transition = "padding-left 220ms ease";
      }

      document.body.classList.toggle("mw-sidebar-collapsed", collapsed);
    };

    apply();
    const raf = window.requestAnimationFrame(apply);
    window.addEventListener("resize", apply);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", apply);
    };
  }, [collapsed, location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/suporte") return;
    const renameClosingAction = () => {
      document.querySelectorAll("button").forEach((button) => {
        if (button.textContent?.trim() === "Resolver chamado") {
          const textNode = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
          if (textNode) textNode.textContent = "Encerrar atendimento";
          else button.append("Encerrar atendimento");
        }
        if (button.textContent?.trim() === "Resolvendo...") {
          const textNode = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
          if (textNode) textNode.textContent = "Encerrando...";
        }
      });
    };
    renameClosingAction();
    const observer = new MutationObserver(renameClosingAction);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  if (location.pathname === "/login") return null;

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
        }
      `}</style>
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="fixed top-[110px] z-50 hidden size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_6px_18px_rgba(7,24,45,.18)] transition-all hover:bg-slate-50 lg:grid"
        style={{ left: collapsed ? COLLAPSED - 18 : EXPANDED - 18 }}
        title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      >
        {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
      </button>
    </>
  );
}
