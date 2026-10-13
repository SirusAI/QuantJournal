import { DailyReviewView } from "@/components/daily-review-view";
import { getStoredDailyReview,listStoredDailyReviews } from "@/lib/daily-review";
import { getNewYorkDayKey,isValidDateKey } from "@/lib/trading-day";
export const dynamic="force-dynamic";
export default async function DailyReviewPage({searchParams}:{searchParams:Promise<{date?:string}>}){
 const params=await searchParams;const selectedDate=isValidDateKey(params.date)?params.date!:getNewYorkDayKey(new Date());
 const [review,history]=await Promise.all([getStoredDailyReview(selectedDate),listStoredDailyReviews()]);
 return <div className="min-h-screen bg-gray-900 p-8 text-white"><DailyReviewView key={selectedDate} selectedDate={selectedDate} initialReview={review} initialHistory={history}/></div>;
}
