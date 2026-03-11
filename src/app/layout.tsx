export const metadata = {
  title: "Keihi Keisan App",
  description: "Expense and journal application workflow",
};

import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
