import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { DAILY_ATTENDANCE_REWARD, WEEKLY_ATTENDANCE_BONUS, grantCurrency } from "@/lib/currency";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type AttendanceRow = {
  reward_date: string;
  streak_count: number;
};

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  const user = await getUserFromRequest(request);

  if (!supabase || !user) {
    return NextResponse.json({ error: "Login is required" }, { status: 401 });
  }

  const today = formatKoreanDate(new Date());
  const yesterday = formatKoreanDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const { data: existing } = await supabase
    .from("attendance_rewards")
    .select("id,reward_amount,bonus_amount")
    .eq("user_id", user.id)
    .eq("reward_date", today)
    .maybeSingle<{ id: string; reward_amount: number; bonus_amount: number }>();

  if (existing) {
    return NextResponse.json({
      claimed: false,
      rewardDate: today,
      rewardAmount: existing.reward_amount,
      bonusAmount: existing.bonus_amount,
      message: "Already claimed"
    });
  }

  const { data: previous } = await supabase
    .from("attendance_rewards")
    .select("reward_date,streak_count")
    .eq("user_id", user.id)
    .order("reward_date", { ascending: false })
    .limit(1)
    .maybeSingle<AttendanceRow>();

  const streak = previous?.reward_date === yesterday ? previous.streak_count + 1 : 1;
  const bonusAmount = streak % 7 === 0 ? WEEKLY_ATTENDANCE_BONUS : 0;
  const rewardAmount = DAILY_ATTENDANCE_REWARD + bonusAmount;
  const idempotencyKey = `attendance:${user.id}:${today}`;

  try {
    const grant = await grantCurrency(supabase, {
      userId: user.id,
      freeAmount: rewardAmount,
      type: "attendance",
      reason: bonusAmount ? "Daily attendance with weekly bonus" : "Daily attendance",
      referenceType: "attendance",
      referenceId: today,
      idempotencyKey,
      metadata: {
        rewardDate: today,
        streak,
        dailyAmount: DAILY_ATTENDANCE_REWARD,
        bonusAmount
      }
    });

    const { error } = await supabase.from("attendance_rewards").insert({
      user_id: user.id,
      reward_date: today,
      streak_count: streak,
      reward_amount: DAILY_ATTENDANCE_REWARD,
      bonus_amount: bonusAmount,
      transaction_id: grant.transactionId
    });

    if (error && error.code !== "23505") throw error;

    return NextResponse.json({
      claimed: true,
      rewardDate: today,
      streak,
      rewardAmount: DAILY_ATTENDANCE_REWARD,
      bonusAmount,
      wallet: {
        paidBalance: grant.paidBalance,
        freeBalance: grant.freeBalance,
        totalBalance: grant.totalBalance
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Attendance reward failed" }, { status: 500 });
  }
}

function formatKoreanDate(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}
