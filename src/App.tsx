//App.tsx
//C:\Users\brad330\Desktop\Brad's Work\Programs\Brads_Card_Game\src\App.tsx

import { CardGameProvider } from "./CardGameContext";
import HomePage from "./Homepage";
import { smartLog } from "./smart_log";

function App() {
  smartLog("app rendered");

  return (
    <CardGameProvider>
      <HomePage />
    </CardGameProvider>
  );
}

export default App;