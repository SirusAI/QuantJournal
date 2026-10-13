export interface ImportedExecution { side: string; quantity: number; price: number; fee: number; reportedPnl: number | null }
export function signedImportedQuantity(execution: Pick<ImportedExecution,"side"|"quantity">): number {
  const side=execution.side.trim().toUpperCase();
  if (["S","SELL","SS","SELLSHORT","SELL_SHORT"].includes(side)) return -Math.abs(execution.quantity);
  if (["B","BUY","BC","BUYTOCOVER","BUY_TO_COVER"].includes(side)) return Math.abs(execution.quantity);
  throw new Error("Unsupported CSV side. Use B/BUY or S/SELL/SS.");
}
export function computeImportedMetrics(executions: ImportedExecution[]) {
  const volume=executions.reduce((sum,e)=>sum+Math.abs(e.quantity),0);
  const fees=executions.reduce((sum,e)=>sum+e.fee,0);
  const hasReportedPnl=executions.some(e=>e.reportedPnl!==null);
  const netQuantity=executions.reduce((sum,e)=>sum+signedImportedQuantity(e),0);
  if(!hasReportedPnl && netQuantity!==0) throw new Error("Broker Pnl is required when CSV fills do not form a complete round trip.");
  const cashFlow=executions.reduce((sum,e)=>sum-signedImportedQuantity(e)*e.price,0);
  // A supplied Pnl column is treated as broker-reported NET P&L. Do not charge its fees twice.
  const netPl=hasReportedPnl?executions.reduce((sum,e)=>sum+(e.reportedPnl??0),0):cashFlow-fees;
  return {volume,fees,netPl:Number(netPl.toFixed(10)),grossPl:Number((hasReportedPnl?netPl+fees:cashFlow).toFixed(10))};
}
