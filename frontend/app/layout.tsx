import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Crash Demo",
  description: "Crash demo points game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="row">
            <h2 style={{ margin: 0 }}>Crash Demo</h2>
            <nav style={{ display: "flex", gap: 12 }}>
              <Link href="/">Game</Link>
              <Link href="/auth">Auth</Link>
            </nav>
          </header>
          <hr />
          {children}
        </div>
      </body>
    </html>
  );
}
