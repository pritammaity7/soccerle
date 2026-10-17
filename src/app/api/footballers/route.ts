import { NextResponse } from 'next/server';
import { allFootballersList } from '@/lib/game/footballers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toUpperCase() || '';
  const letterCount = searchParams.get('length');
  
  let filtered = allFootballersList;
  
  // Filter by letter count if specified
  if (letterCount) {
    const count = parseInt(letterCount);
    filtered = filtered.filter(f => f.letterCount === count);
  }
  
  // Filter by search term
  if (search) {
    filtered = filtered.filter(f => 
      f.normalizedName.includes(search) || 
      f.name.toUpperCase().includes(search)
    );
  }
  
  // Return only necessary info for autocomplete
  const results = filtered.slice(0, 50).map(f => ({
    name: f.name,
    normalizedName: f.normalizedName,
    country: f.country,
    letterCount: f.letterCount
  }));
  
  return NextResponse.json({ footballers: results, total: filtered.length });
}
