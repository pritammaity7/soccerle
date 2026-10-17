import { NextResponse } from 'next/server';
import { answerFootballers, allFootballerNames } from '@/lib/game/footballers';
import { getDailyAnswerIndex, obfuscateAnswer } from '@/lib/game/crypto';

const START_DATE_STR = '2024-01-01';
const SECRET_SEED = 'strikerle-2024-secret';

// Get today's date string in UTC
function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// Compare two date strings (YYYY-MM-DD format)
function isDateAfter(date1: string, date2: string): boolean {
  return date1 > date2;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  
  // Get the requested date or use today
  const dateString = dateParam || getTodayString();
  const todayString = getTodayString();
  
  // Future games not allowed
  if (isDateAfter(dateString, todayString)) {
    return NextResponse.json({ error: 'Future games not available' }, { status: 400 });
  }
  
  // Games before start date not allowed
  if (isDateAfter(START_DATE_STR, dateString)) {
    return NextResponse.json({ error: 'Game not available for this date' }, { status: 400 });
  }
  
  // Parse date for index calculation
  const [year, month, day] = dateString.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  
  // Get the daily footballer from ANSWER list only
  const index = getDailyAnswerIndex(targetDate, answerFootballers.length, SECRET_SEED);
  const footballer = answerFootballers[index];
  
  if (!footballer) {
    return NextResponse.json({ error: 'Failed to get footballer' }, { status: 500 });
  }
  
  // Return public info (not the name)
  return NextResponse.json({
    date: dateString,
    letterCount: footballer.letterCount,
    hint: {
      country: footballer.country,
      position: footballer.position,
      popularity: footballer.popularity
    },
    answerHash: obfuscateAnswer(footballer.normalizedName, dateString),
    totalFootballers: answerFootballers.length,
    totalValidGuesses: allFootballerNames.length
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { date, guess } = body;
  
  // Parse date
  const [year, month, day] = date.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  
  // Normalize the guess
  const normalizedGuess = guess.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Get the daily footballer from ANSWER list
  const index = getDailyAnswerIndex(targetDate, answerFootballers.length, SECRET_SEED);
  const footballer = answerFootballers[index];
  
  // Check if guess is correct
  const isCorrect = normalizedGuess === footballer.normalizedName;
  
  // Check if guess is a valid footballer name (from ALL names list)
  const isValidGuess = allFootballerNames.includes(normalizedGuess);
  
  return NextResponse.json({
    isCorrect,
    isValidGuess,
    letterCount: footballer.letterCount,
    answer: isCorrect ? footballer.normalizedName : undefined
  });
}
