//App.tsx
//C:\Users\brad330\Desktop\Brad's Work\Programs\Brads_Card_Game\src\App.tsx

import { Component, type ReactNode } from "react";
import { CardGameProvider } from "./CardGameContext";
import HomePage from "./Homepage";
import { smartLog } from "./smart_log";

class MatchErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; retries: number }> {
  state = { failed: false, retries: 0 };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: Error) {
    console.error("Game view failed:", error);
    if (window.location.hash.startsWith("#friend=") && this.state.retries === 0) {
      window.setTimeout(() => this.setState({ failed: false, retries: 1 }), 500);
    }
  }

  render() {
    if (this.state.failed) return (
      <main className="game-home" style={{ display: "grid", placeItems: "center" }}>
        <div role="alert" style={{ textAlign: "center" }}>
          <h1>Reconnecting to your match</h1>
          <p>Your last move is saved on the room server.</p>
          <button onClick={() => this.setState({ failed: false, retries: this.state.retries + 1 })}>Resume Match</button>
        </div>
      </main>
    );
    return this.props.children;
  }
}

function App() {
  smartLog("app rendered");

  return (
    <MatchErrorBoundary>
      <CardGameProvider>
        <HomePage />
      </CardGameProvider>
    </MatchErrorBoundary>
  );
}

export default App;
