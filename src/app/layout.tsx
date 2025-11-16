import "./globals.css";
import TopNav from "./components/TopNav";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <TopNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
