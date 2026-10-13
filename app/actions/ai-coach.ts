"use server";
import { db } from "@/lib/db";
import { generateAi } from "@/lib/ai-client";
import { resolveConnection } from "@/lib/local-settings";
import type { Stats } from "@/lib/stats";
export async function getAiCoachAdvice(stats:Partial<Stats>,connectionId?:string){
 try{const connection=resolveConnection(connectionId,"ai-coach");
 const evidence=Object.fromEntries(Object.entries(stats).filter(([key,value])=>!["kRatio","probabilityRandomChance"].includes(key)&&typeof value==="number"&&Number.isFinite(value)));
 const advice=await generateAi(connection,{system:"You are an evidence-first trading performance coach. Use only the supplied statistics. Do not infer a personal profile, invent market data, predict returns or treat historical associations as causes. Explain limitations and propose practical actions grounded in the supplied evidence.",user:"Analyze these selected-period trading statistics:\n"+JSON.stringify(evidence)});
 await db.coachingSession.create({data:{advice,stats:JSON.stringify({evidence,provider:connection.provider,modelId:connection.modelId,connectionName:connection.name})}});
 return {success:true,advice};
 }catch(error){return {success:false,error:error instanceof Error?error.message:"AI Coach generation failed."};}
}
export async function getCoachingHistory(){return {success:true,history:await db.coachingSession.findMany({orderBy:{createdAt:"desc"},take:100})};}
export async function deleteCoachingSession(id:string){await db.coachingSession.delete({where:{id}});return {success:true};}
