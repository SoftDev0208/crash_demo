import "./globals.css";

export const metadata = {
  title: "Crash Demo",
  description: "Crash demo points game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ margin: 0 }}>Crash Demo</h2>
            <nav style={{ display: "flex", gap: 12 }}>
              <a href="/" style={{ textDecoration: "none" }}>Game</a>
              <a href="/auth" style={{ textDecoration: "none" }}>Auth</a>
            </nav>
          </header>
          <hr />
          {children}
        </div>
      </body>
    </html>
  );
}
