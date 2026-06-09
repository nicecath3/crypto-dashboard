import type { Metadata } from 'next';
import './globals.scss';
import { ThemeProvider } from './contexts/ThemeContext';

export const metadata: Metadata = {
  title: '코인 대시보드',
  description: '업비트 실시간 암호화폐 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
