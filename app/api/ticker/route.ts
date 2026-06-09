import { WebSocket } from 'ws';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { markets } = await req.json() as { markets: string[] };

  if (!markets?.length) {
    return new Response('markets 필요', { status: 400 });
  }

  const encoder = new TextEncoder();
  let upbitWs: WebSocket | null = null;

  const stream = new ReadableStream({
    start(controller) {
      upbitWs = new WebSocket('wss://api.upbit.com/websocket/v1');

      upbitWs.on('open', () => {
        console.log('[서버WS] 업비트 연결 성공, 마켓 수:', markets.length);
        upbitWs!.send(
          JSON.stringify([
            { ticket: `sse-${Date.now()}` },
            { type: 'ticker', codes: markets },
          ])
        );
      });

      upbitWs.on('message', (data: Buffer) => {
        try {
          const raw = JSON.parse(data.toString('utf-8'));
          // WS 응답은 code, REST 응답은 market — 통일
          const ticker = { ...raw, market: raw.market ?? raw.code };
          if (ticker.market) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ticker)}\n\n`));
          }
        } catch {}
      });

      let closed = false;
      const closeStream = () => { if (!closed) { closed = true; try { controller.close(); } catch {} } };
      upbitWs.on('error', closeStream);
      upbitWs.on('close', closeStream);
    },
    cancel() {
      upbitWs?.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
