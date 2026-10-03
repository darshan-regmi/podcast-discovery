import { NextResponse } from 'next/server'
import { getAllEpisodes } from '@/lib/feeds'

export async function GET() {
  const { episodes, errors } = await getAllEpisodes()
  return NextResponse.json({ episodes, errors })
}
