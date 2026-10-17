import { NextResponse } from 'next/server';
import { answerFootballers, allFootballerNames } from '@/lib/game/footballers';
import { getDailyAnswerIndex } from '@/lib/game/crypto';

const SECRET_SEED = 'strikerle-2024-secret';

// Get letter states for a guess compared to answer
function getLetterStates(guess: string, answer: string) {
  const normalizedGuess = guess.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const normalizedAnswer = answer.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  
  const states: { letter: string; status: string }[] = [];
  const answerLetters = normalizedAnswer.split('');
  const guessLetters = normalizedGuess.split('');
  const remainingAnswerLetters = [...answerLetters];
  
  // First pass: correct letters
  guessLetters.forEach((letter, index) => {
    if (letter === answerLetters[index]) {
      states[index] = { letter, status: 'correct' };
      remainingAnswerLetters[index] = '#';
    }
  });
  
  // Second pass: present and absent
  guessLetters.forEach((letter, index) => {
    if (states[index]) return;
    const presentIndex = remainingAnswerLetters.findIndex(l => l === letter);
    if (presentIndex !== -1) {
      states[index] = { letter, status: 'present' };
      remainingAnswerLetters[presentIndex] = '#';
    } else {
      states[index] = { letter, status: 'absent' };
    }
  });
  
  return states;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { date, guess } = body;
  
  // Parse date as UTC
  const [year, month, day] = date.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  
  // Get answer from ANSWER list only
  const index = getDailyAnswerIndex(targetDate, answerFootballers.length, SECRET_SEED);
  const footballer = answerFootballers[index];
  
  // Normalize the guess
  const normalizedGuess = guess.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Check if guess is correct
  const isCorrect = normalizedGuess === footballer.normalizedName;
  
  // Check if guess is a valid footballer name (from ALL names list)
  const isValidGuess = allFootballerNames.includes(normalizedGuess);
  
  // Get letter states only if valid guess
  const letterStates = isValidGuess ? getLetterStates(guess, footballer.normalizedName) : [];
  
  return NextResponse.json({
    isCorrect,
    isValidGuess,
    letterCount: footballer.letterCount,
    letterStates,
    showAnswer: isCorrect
  });
}
