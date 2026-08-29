import { useState } from "react";
import TransactionsLegacy from "./TransactionsLegacy";
import CounterpartyDrawer from "../components/CounterpartyDrawer";

export default function Transactions() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [version, setVersion] = useState(0);

  function interceptCadastros(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button");
    if (!button) return;
    const label = button.textContent?.trim().toLowerCase() || "";
    const title = button.getAttribute("title")?.trim().toLowerCase() || "";
    if (label.includes("cadastros") || title === "novo cadastro") {
      event.preventDefault();
      event.stopPropagation();
      setDrawerOpen(true);
    }
  }

  return (
    <>
      <div onClickCapture={interceptCadastros}>
        <TransactionsLegacy key={version} />
      </div>
      <CounterpartyDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onChanged={() => setVersion((value) => value + 1)}
      />
    </>
  );
}
