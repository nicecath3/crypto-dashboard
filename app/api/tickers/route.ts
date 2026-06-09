export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const markets = searchParams.get('markets');
  if (!markets) return new Response('markets 필요', { status: 400 });

  const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${markets}`);
  const data = await res.json();
  return Response.json(data);
}
