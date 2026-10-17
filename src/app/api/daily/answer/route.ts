import { NextResponse } from 'next/server';
import { answerFootballers } from '@/lib/game/footballers';
import { getDailyAnswerIndex } from '@/lib/game/crypto';

const SECRET_SEED = 'strikerle-2024-secret';

// Get today's date string in UTC
function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  
  if (!dateParam) {
    return NextResponse.json({ error: 'Date required' }, { status: 400 });
  }
  
  // Only reveal answer for past games or today
  const todayString = getTodayString();
  if (dateParam > todayString) {
    return NextResponse.json({ error: 'Cannot reveal future answers' }, { status: 400 });
  }
  
  // Parse date as UTC
  const [year, month, day] = dateParam.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  
  // Get answer from ANSWER list only
  const index = getDailyAnswerIndex(targetDate, answerFootballers.length, SECRET_SEED);
  const footballer = answerFootballers[index];
  
  return NextResponse.json({
    footballer: {
      id: footballer.id,
      name: footballer.name,
      normalizedName: footballer.normalizedName,
      country: footballer.country,
      position: footballer.position,
      popularity: footballer.popularity,
      info: footballer.info,
      achievements: footballer.achievements,
      active: footballer.active,
      birthYear: footballer.birthYear,
      letterCount: footballer.letterCount
    }
  });
}
