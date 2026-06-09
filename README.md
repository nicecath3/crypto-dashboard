# 📈 CryptoSim — 가상 코인 투자 시뮬레이터

업비트 실시간 데이터 기반 가상 투자 시뮬레이션 포트폴리오 프로젝트

---

## 💡 개발 동기

코인 투자에 관심이 생겼지만 실제 돈을 쓰기엔 부담스러운 상황에서, 실제 시세 데이터로 매수·매도를 연습할 수 있는 환경을 직접 만들어보고 싶었습니다.
단순한 시세 조회에 그치지 않고, 지정가·시장가 주문 · 수수료 계산 · 미체결 주문 관리 · 체결 내역 저장까지 실제 거래소의 핵심 기능을 최대한 구현하는 것을 목표로 개발했습니다.

---

## ⚡ 주요 기능

- **실시간 시세** — 업비트 WebSocket(SSE 프록시) 기반 전 코인 실시간 가격 스트리밍
- **캔들 차트** — 1분 / 5분 / 30분 / 1시간 / 일봉 / 주봉 / 월봉 지원, 마우스 휠 줌
- **시장가 주문** — 현재가로 즉시 체결, 수량 % 버튼 (10 / 25 / 50 / 100%)
- **지정가 주문** — 목표가 도달 시 자동 체결, 미체결 주문 목록 관리 및 취소
- **수수료 계산** — 실제 업비트와 동일한 0.05% 수수료 적용, 예상 수수료 실시간 표시
- **보유 코인** — 평균 단가 · 평가 손익 · 수익률 실시간 계산
- **주문내역** — 미체결 지정가 주문 목록, 취소 기능
- **체결내역** — 시장가·지정가 전체 체결 기록, 코인별 필터
- **코인 검색** — 이름 / 거래대금 / 전일대비 정렬, 즐겨찾기
- **다크 / 라이트 테마** — CSS 커스텀 프로퍼티 기반 테마 토글
- **초기화** — 가상 자산 · 보유 코인 · 주문내역 · 즐겨찾기 전체 초기화 (초기 자산 1억 원)

---

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router), React 19 |
| 언어 | TypeScript |
| 스타일 | SCSS Modules, CSS Custom Properties |
| 실시간 통신 | Upbit WebSocket → Next.js SSE Route Handler |
| 상태 저장 | localStorage |
| 배포 | Vercel |

---

## 📁 프로젝트 구조

```
app/
├── api/
│   └── ticker/               # Upbit WebSocket → SSE 프록시 Route Handler
├── components/
│   ├── Dashboard.tsx         # 최상위 레이아웃, 포트폴리오 상태 관리, 지정가 체결 로직
│   ├── CoinPanel.tsx         # 코인 목록 (검색 / 즐겨찾기 / 보유코인), 정렬, 테마 토글
│   ├── CandleChart.tsx       # SVG 캔들 차트, 휠 줌, 실시간 마지막 봉 업데이트
│   ├── TickerHeader.tsx      # 현재가 · 고가 · 저가 · 거래대금 헤더
│   ├── TradePanel.tsx        # 매수 / 매도 / 주문내역 / 체결내역 탭
│   └── DisclaimerModal.tsx   # 첫 방문 시 가상 투자 안내 모달
├── contexts/
│   └── ThemeContext.tsx      # 다크 / 라이트 테마 컨텍스트
├── hooks/
│   └── useUpbitTicker.ts     # SSE 연결 · 전 코인 티커 구독 훅
├── lib/
│   └── upbit.ts              # 마켓 목록 · 캔들 API 유틸
├── styles/
│   └── tokens.scss           # 디자인 토큰 (색상, 폰트, 간격 등)
├── types/
│   └── upbit.ts              # Upbit API 응답 타입 정의
└── globals.scss              # 전역 스타일, CSS 커스텀 프로퍼티 (다크 / 라이트)
```

---

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000) 접속

> 별도 환경 변수 설정 없이 바로 실행됩니다. 업비트 WebSocket은 서버에서 연결해 SSE로 클라이언트에 전달합니다.

---

## 🔧 개발하면서 해결한 문제들

### 1. 브라우저에서 Upbit WebSocket 직접 연결 불가

브라우저에서 업비트 WebSocket(`wss://`)에 직접 접속하면 CORS 정책으로 차단됩니다.

Next.js Route Handler에서 서버 사이드로 WebSocket을 연결한 뒤, 수신된 메시지를 SSE(Server-Sent Events)로 클라이언트에 스트리밍하는 프록시 구조로 해결했습니다. 클라이언트는 단순히 `/api/ticker`를 SSE로 구독하면 됩니다.

---

### 2. 지정가 매도 주문 시 보유 코인이 즉시 사라지는 문제

지정가 매도 주문을 걸면 보유 코인에서 수량이 즉시 차감되어, 실제 체결 전에도 코인이 없어 보이는 문제가 있었습니다.

실제 거래소처럼 **주문 등록 시에는 코인을 차감하지 않고**, 가격 조건이 충족되어 체결될 때 차감하도록 수정했습니다. 대신 추가 매도 주문 시 미체결 수량을 합산해 가용 수량을 계산합니다.

```ts
// 매도 가용 수량 = 보유량 - 미체결 매도 주문 수량
const availableQty = holding.amount - pendingSellQty;
```

---

### 3. 시장가 100% 매수 시 수량이 가격 변동에 따라 달라지는 문제

100% 버튼을 눌렀을 때 수량을 고정해두면, 실시간으로 가격이 오를 때 총액이 잔액을 초과해 주문이 실패하는 문제가 있었습니다.

`buyPct` 상태를 별도로 관리하고, 현재가(`marketPrice`)가 변동될 때마다 수량을 재계산하는 useEffect를 두어 항상 잔액 범위 안에서 최대 수량이 유지되도록 했습니다.

```ts
useEffect(() => {
  if (tab !== 'buy' || orderType !== 'market' || buyPct === null) return;
  const raw = (portfolio.krw * buyPct) / (marketPrice * (1 + FEE_RATE));
  setAmount(String(Math.floor(raw * 1e8) / 1e8));
}, [marketPrice, buyPct, portfolio.krw]);
```

---

### 4. 실시간 캔들 차트 마지막 봉 업데이트

캔들 데이터를 fetch로만 관리하면 현재 봉이 실시간으로 갱신되지 않아 차트가 정적으로 보이는 문제가 있었습니다.

WebSocket 티커에서 `trade_price`가 변경될 때마다 마지막 캔들의 종가 · 고가 · 저가를 직접 업데이트하는 방식으로 해결했습니다.

```ts
setData((prev) => {
  const last = prev[prev.length - 1];
  return [...prev.slice(0, -1), {
    ...last,
    close: ticker.trade_price,
    high: Math.max(last.high, ticker.trade_price),
    low: Math.min(last.low, ticker.trade_price),
  }];
});
```

---

## 📌 구현 참고 사항

### 가상 자산
초기 자산은 1억 원이며, 모든 데이터는 `localStorage`에 저장됩니다. 실제 자산과 무관하며 거래소 API를 통한 실제 거래는 발생하지 않습니다.

### 수수료
업비트 기준 매수·매도 각 0.05%를 적용합니다.

### 지정가 체결 조건
- 매수: 현재가 ≤ 목표가
- 매도: 현재가 ≥ 목표가
- 주문 등록 후 2초 이내 조건 충족 시에는 체결하지 않아 즉시 시장가 체결 방지
