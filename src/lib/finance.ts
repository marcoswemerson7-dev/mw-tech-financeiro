// Ponte temporária: mantém os imports dos componentes enquanto a implementação vive em services.
export { getAccounts, peekAccounts, type Account } from "../services/accounts";
export { getMovements, peekMovements, registerMovement, type Movement } from "../services/transactions";
export { uploadReceipt } from "../services/storage";
