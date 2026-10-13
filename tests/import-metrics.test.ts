import assert from "node:assert/strict";
import {test} from "node:test";
import {computeImportedMetrics,signedImportedQuantity} from "../lib/import-metrics.ts";
test("CSV signed fills retain absolute volume and calculate net P&L including fees",()=>{
 const result=computeImportedMetrics([{side:"B",quantity:2,price:100,fee:0.1,reportedPnl:null},{side:"S",quantity:-2,price:101,fee:0.1,reportedPnl:null}]);
 assert.deepEqual(result,{volume:4,fees:0.2,netPl:1.8,grossPl:2});
});
test("Broker-reported net P&L is retained without a second fee deduction",()=>{
 const result=computeImportedMetrics([{side:"B",quantity:2,price:100,fee:0.1,reportedPnl:null},{side:"S",quantity:2,price:101,fee:0.1,reportedPnl:1.7}]);
 assert.equal(result.netPl,1.7);assert.equal(result.grossPl,1.9);assert.equal(result.volume,4);
});
test("Short sales and covers use sides for direction regardless of input quantity sign",()=>{
 const result=computeImportedMetrics([{side:"SS",quantity:2,price:100,fee:0.1,reportedPnl:null},{side:"BC",quantity:-2,price:99,fee:0.1,reportedPnl:null}]);
 assert.equal(result.netPl,1.8);assert.equal(signedImportedQuantity({side:"SS",quantity:2}),-2);
 assert.throws(()=>signedImportedQuantity({side:"unknown",quantity:2}));
});
test("Unmatched fills cannot turn an open position's cash outlay into a realized loss",()=>{
 assert.throws(()=>computeImportedMetrics([{side:"B",quantity:2,price:100,fee:0.1,reportedPnl:null}]),/complete round trip/);
});
