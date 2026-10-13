import Papa from "papaparse";
import { computeImportedMetrics, signedImportedQuantity } from "./import-metrics.ts";
import { getTimeZoneOffset, isValidDateKey } from "./trading-day.ts";
import type { TradeInput } from "./journal-client.ts";
export const CSV_HEADER = "Time,Symbol,Price,Side,Quantity,Fee,Route,Pnl";
export const SAMPLE_CSV = `${CSV_HEADER}\n09:30:00,DEMO,100.00,B,10,0.50,,\n10:00:00,DEMO,102.00,S,10,0.50,,\n`;
export const SAMPLE_TSV = "TradeDate\tExecutionTime\tBuySell\tSymbol\tOrderId\tQuantity\tPrice\tFee\tPnl\n6/30/2026\t2026-06-30T09:30:00\tBuy\tDEMO\tDEMO-1\t10\t100.00\t0.50\t\n6/30/2026\t2026-06-30T10:00:00\tSell\tDEMO\tDEMO-2\t10\t102.00\t0.50\t\n";
export interface BrokerFill { time: string; side: string; price: number; quantity: number; fee: number; route: string; reportedPnl: number | null }
export interface BrokerGroup { symbol: string; date: string; direction: "LONG" | "SHORT"; executions: BrokerFill[]; volume: number; fees: number; netPl: number; grossPl: number }
const aliases: Record<string,string> = {B:"B",BUY:"B",S:"S",SELL:"S",SS:"SS",SHORT:"SS",SELLSHORT:"SS",SELL_SHORT:"SS",BC:"B",BUYTOCOVER:"B",BUY_TO_COVER:"B"};
function numeric(value: string, label: string, optional=false) {
  const clean=value.trim().replaceAll(",", "").replace(/^\$/, "");
  if(!clean&&optional)return 0;
  if(!/^-?\d+(\.\d+)?$/.test(clean)||!Number.isFinite(Number(clean)))throw new Error(`${label}: enter a numeric value without currency text.`);
  return Number(clean);
}
function fill(cells:string[],date:string,row:number):BrokerFill {
  const [rawTime,,rawPrice,rawSide,rawQty,rawFee="",route="",rawPnl=""]=cells;
  const time=rawTime.trim();
  if(!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time))throw new Error(`Row ${row}: Time must be HH:mm:ss in America/New_York.`);
  const normalizedTime=time.length===5?time+":00":time;
  const side=aliases[rawSide.trim().toUpperCase().replaceAll(" ","_")];
  if(!side)throw new Error(`Row ${row}: unsupported side. Use B, S, SS, or BUY_TO_COVER.`);
  const price=numeric(rawPrice,`Row ${row} price`),quantity=numeric(rawQty,`Row ${row} quantity`),fee=numeric(rawFee,`Row ${row} fee`,true);
  if(price<=0||quantity===0||!Number.isInteger(quantity))throw new Error(`Row ${row}: price and whole-share quantity must be valid; fees must be numeric.`);
  return {time:new Date(`${date}T${normalizedTime}${getTimeZoneOffset(date,normalizedTime)}`).toISOString(),side,price,quantity:Math.abs(quantity),fee,route:route.trim(),reportedPnl:rawPnl.trim()?numeric(rawPnl,`Row ${row} net Pnl`):null};
}
function grouped(rows:{date:string;symbol:string;execution:BrokerFill}[]):BrokerGroup[] {
  const map=new Map<string,{date:string;symbol:string;executions:BrokerFill[]}>();
  for(const row of rows){const key=row.date+":"+row.symbol;if(!map.has(key))map.set(key,{date:row.date,symbol:row.symbol,executions:[]});map.get(key)!.executions.push(row.execution);}
  return [...map.values()].map(item=>{item.executions.sort((a,b)=>a.time.localeCompare(b.time));return {...item,...computeImportedMetrics(item.executions),direction:signedImportedQuantity(item.executions[0])<0?"SHORT":"LONG"};});
}
function ticker(value:string,row:number){const text=value.trim().toUpperCase();if(!/^[A-Z0-9][A-Z0-9.^=_-]{0,30}$/.test(text))throw new Error(`Row ${row}: missing or invalid stock symbol.`);return text;}
function parsedRows(text:string,delimiter:string){
  const parsed=Papa.parse<string[]>(text.replace(/^\uFEFF/,""),{delimiter,skipEmptyLines:"greedy"});
  if(parsed.errors.length)throw new Error("CSV quoting is invalid. Export the template as a comma-separated UTF-8 CSV.");
  if(parsed.data.length<2)throw new Error("The file contains no execution rows. Download the completed sample to see the required format.");return parsed.data;
}
export function parseBrokerCsv(text:string,filename:string,fallbackDate:string):BrokerGroup[]{
  const rows=parsedRows(text,",");
  if(rows[0].map(v=>v.trim().toLowerCase()).join(",")!==CSV_HEADER.toLowerCase())throw new Error(`Use the template columns in this order: ${CSV_HEADER}. Convert the broker export before importing.`);
  const match=filename.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})/);
  const date=match?`${match[3]}-${match[1].padStart(2,"0")}-${match[2].padStart(2,"0")}`:fallbackDate;
  if(!isValidDateKey(date)||new Date(date+"T12:00:00Z").toISOString().slice(0,10)!==date)throw new Error("Choose a valid fallback date or name the file MM-DD-YYYY.csv.");
  return grouped(rows.slice(1).map((cells,i)=>{if(cells.length!==8)throw new Error(`Row ${i+2}: expected 8 columns, including empty Route and Pnl columns.`);return {date,symbol:ticker(cells[1],i+2),execution:fill(cells,date,i+2)};}));
}
export function parseBrokerPaste(text:string):BrokerGroup[]{
  const rows=parsedRows(text,"\t"),expected=["tradedate","executiontime","buysell","symbol","orderid","quantity","price"];
  if(rows[0].slice(0,7).map(v=>v.trim().toLowerCase()).join()!==expected.join())throw new Error("Use the tab-separated sample header: TradeDate, ExecutionTime, BuySell, Symbol, OrderId, Quantity, Price, Fee, Pnl.");
  return grouped(rows.slice(1).map((cells,i)=>{if(cells.length<7)throw new Error(`Row ${i+2}: expected at least 7 tab-separated fields.`);
    const parts=cells[0].split("/"),date=parts.length===3?`${parts[2]}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}`:cells[0];
    if(!isValidDateKey(date)||new Date(date+"T12:00:00Z").toISOString().slice(0,10)!==date)throw new Error(`Row ${i+2}: invalid TradeDate. Use M/D/YYYY or YYYY-MM-DD.`);
    const time=cells[1].includes("T")?cells[1].split("T")[1]:cells[1];
    return {date,symbol:ticker(cells[3],i+2),execution:fill([time,cells[3],cells[6],cells[2],cells[5],cells[7]??"","",cells[8]??""],date,i+2)};
  }));
}
export function prepareManualTrade(input:TradeInput){
  if(typeof input.symbol!=="string"||!isValidDateKey(input.date))throw new Error("Symbol and a valid trading date are required.");
  const symbol=ticker(input.symbol,1),manual=input.pnl!==undefined;
  if(manual&&!Number.isFinite(input.pnl))throw new Error("Manual net P&L must be a finite number.");
  const executions=(input.executions??[]).map((e,i)=>fill([e.time,symbol,String(e.price),e.side,String(e.quantity),String(e.fee??0),"",e.pnl===undefined||e.pnl===""?"":String(e.pnl)],input.date,i+1));
  const metrics=executions.length?computeImportedMetrics(executions.map(e=>({...e,reportedPnl:manual?0:e.reportedPnl}))):{netPl:0,grossPl:0,volume:0,fees:0};
  const netPl=input.pnl??metrics.netPl;
  return {symbol,date:input.date,notes:input.notes??"",tags:[...new Set((input.tags??"").split(",").map(t=>t.trim()).filter(Boolean))],executions,direction:executions[0]&&signedImportedQuantity(executions[0])<0?"SHORT":"LONG",status:executions.length?"CLOSED":"OPEN",netPl,grossPl:manual?netPl+metrics.fees:metrics.grossPl,volume:metrics.volume,fees:metrics.fees,isManualPnl:manual,winLoss:netPl>0?"WIN":netPl<0?"LOSS":"BREAK_EVEN"};
}
