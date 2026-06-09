import type { Market } from '../../types/upbit';

export const runtime = 'nodejs';
export const revalidate = 3600; // 1시간 캐시

export async function GET() {
  const res = await fetch('https://api.upbit.com/v1/market/all?is_details=false', {
    next: { revalidate: 3600 },
  });
  const data: Market[] = await res.json();
  const krw = data.filter((m) => m.market.startsWith('KRW-'));
  return Response.json(krw);
}
