import { useState } from "react";
import TransactionsLegacy from "./TransactionsLegacy";
import CounterpartyDrawer from "../components/CounterpartyDrawer";

export default function Transactions() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [version, setVersion] = useState(0);

  return (
    <>
      <TransactionsLegacy key={version} onOpenCadastros={() => setDrawerOpen(true)} />
      <CounterpartyDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onChanged={() => setVersion((value) => value + 1)}
      />
    </>
  );
}
