"use server";
import { revalidatePath } from "next/cache";
import { generateAndStoreDailyReview, getStoredDailyReview, listStoredDailyReviews } from "@/lib/daily-review";
import { isValidDateKey } from "@/lib/trading-day";
export async function getDailyReview(reviewDate: string) {
 if (!isValidDateKey(reviewDate)) return {success:false,error:"Invalid review date."};
 return {success:true,review:await getStoredDailyReview(reviewDate)};
}
export async function listDailyReviews(){return {success:true,reviews:await listStoredDailyReviews()};}
export async function generateDailyReview({reviewDate,connectionId,force=false,includeNotes=false}:{reviewDate:string;connectionId:string;force?:boolean;includeNotes?:boolean}){
 if(!isValidDateKey(reviewDate))return {success:false,error:"Invalid review date."};
 try {const result=await generateAndStoreDailyReview(reviewDate,connectionId,force,includeNotes);revalidatePath("/daily-review");
 if(result.status==="success")return {success:true,review:result.review,cached:result.cached};
 if(result.status==="no_trades")return {success:true,noTrades:true,message:result.message};
 return {success:false,error:result.message,review:result.review};
 }catch(error){return {success:false,error:error instanceof Error?error.message:"Daily Review generation failed."};}
}
