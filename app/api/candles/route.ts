export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');      // minutes / days / weeks / months
  const minutes = searchParams.get('minutes');
  const market = searchParams.get('market');
  const count = searchParams.get('count') ?? '200';

  if (!type || !market) return new Response('type, market 필요', { status: 400 });

  let endpoint = '';
  if (type === 'minutes' && minutes) {
    endpoint = `https://api.upbit.com/v1/candles/minutes/${minutes}?market=${market}&count=${count}`;
  } else {
    endpoint = `https://api.upbit.com/v1/candles/${type}?market=${market}&count=${count}`;
  }

  const res = await fetch(endpoint);
  const data = await res.json();
  return Response.json(data);
}
