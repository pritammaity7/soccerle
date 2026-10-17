import { NextResponse } from 'next/server';
import { allFootballersList } from '@/lib/game/footballers';
import { generateShortId } from '@/lib/game/crypto';

// In-memory storage for custom games (use a database in production)
const customGames = new Map<string, { footballerId: number; createdAt: Date }>();

export async function POST(request: Request) {
  const body = await request.json();
  const { footballerId } = body;
  
  // Validate footballer exists
  const footballer = allFootballersList.find(f => f.id === footballerId);
  if (!footballer) {
    return NextResponse.json({ error: 'Footballer not found' }, { status: 404 });
  }
  
  // Generate a unique ID
  const id = generateShortId();
  
  // Store the custom game
  customGames.set(id, {
    footballerId,
    createdAt: new Date()
  });
  
  return NextResponse.json({
    id,
    gameUrl: `/custom/${id}`,
    footballer: {
      name: footballer.name,
      country: footballer.country,
      letterCount: footballer.letterCount
    }
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id || !customGames.has(id)) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }
  
  const game = customGames.get(id)!;
  const footballer = allFootballersList.find(f => f.id === game.footballerId);
  
  if (!footballer) {
    return NextResponse.json({ error: 'Footballer not found' }, { status: 404 });
  }
  
  return NextResponse.json({
    id,
    letterCount: footballer.letterCount,
    hint: {
      country: footballer.country,
      position: footballer.position,
      popularity: footballer.popularity
    },
    createdAt: game.createdAt
  });
}
