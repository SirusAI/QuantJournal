import { DEMO_DATE, DEMO_SYMBOLS, DEMO_PRICES, nyTimestamp } from "./fixtures.ts";
import { availableYfinanceIntervals } from "../lib/market-types.ts";
import type { MarketDataResult, MarketBar } from "../lib/market-types.ts";
import { MARKET_INTERVALS } from "../lib/settings-types.ts";
import type { MarketInterval, MarketSource, MarketSettings } from "../lib/settings-types.ts";
/** These are deliberately fictional fixtures, never a fallback for the real providers. */
export function syntheticMarket(symbol:string,from:string,to:string,source:MarketSource,interval:MarketInterval,settings:MarketSettings):MarketDataResult {
  const available=source==="yfinance"?availableYfinanceIntervals(from,new Date(DEMO_DATE+"T23:59:59Z")):source==="custom"?settings.custom.intervals:[...MARKET_INTERVALS];
  const base:MarketDataResult={status:"no_data",bars:[],source,interval,timeZone:"America/New_York",adjustment:source==="custom"?settings.custom.adjustment:"unadjusted",requested:{from,to},coverage:null,limitations:[`Synthetic market data — simulating ${source}. No provider was contacted.`,"Fictional prices cannot evaluate real execution quality."],availableIntervals:available};
  const index=DEMO_SYMBOLS.indexOf(symbol.toUpperCase());
  if(index<0||from<"2026-01-01"||to>DEMO_DATE||from>to){base.limitations.push("Fixtures cover SPY, AAPL, MSFT, NVDA and TSLA during January–June 2026 only.");return base;}
  if(!available.includes(interval)){base.status="unsupported";base.limitations.push("This interval exceeds the simulated history window. Choose daily or hourly bars, or another source.");return base;}
  const bars:MarketBar[]=[];
  for(let ms=Date.parse(from+"T12:00:00Z");ms<=Date.parse(to+"T12:00:00Z");ms+=86400000){
    const d=new Date(ms);if(d.getUTCDay()===0||d.getUTCDay()===6)continue;
    const date=d.toISOString().slice(0,10),day=Math.floor(ms/86400000),price=DEMO_PRICES[index]+Math.sin(day*0.18+index)*8;
    if(interval==="1d"){const close=price+Math.sin(day*0.7)*3;bars.push({date,time:Math.floor(Date.parse(date+"T00:00:00Z")/1000),open:price,close,high:Math.max(price,close)+2,low:Math.min(price,close)-2,volume:1000000+day%1000*200});}
    else {const step=Number(interval.replace("m","")),start=settings.prepost?240:570,end=settings.prepost?1200:960;
      for(let minute=start;minute<end;minute+=step){const open=price+Math.sin(minute*0.021+day)*2,close=open+Math.sin(minute*0.17)*0.3;bars.push({date,time:Date.parse(nyTimestamp(date,minute))/1000,open,close,high:Math.max(open,close)+0.2,low:Math.min(open,close)-0.2,volume:1000+minute*10});}
    }
  }
  return {...base,status:bars.length?"ok":"no_data",bars,coverage:bars.length?{from:bars[0].date,to:bars.at(-1)!.date}:null};
}
