import { useState } from "react";
import { campaignStages, type CampaignStage } from "./campaign";
import "./CampaignMap.css";

export default function CampaignMap({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<CampaignStage | null>(null);
  return <main className="campaign-screen">
    <header className="campaign-header"><button onClick={onBack}>← Back to Home</button><h1>Campaign Mode</h1><p>Coming Soon</p></header>
    <div className="campaign-map-frame">
      <img className="campaign-map-art" src={`${import.meta.env.BASE_URL}assets/campaign-map.png`} alt="Fantasy overworld with nine campaign locations" />
      {campaignStages.map(stage => <button key={stage.id} className="campaign-location"
        style={{ left: `${stage.x}%`, top: `${stage.y}%` }}
        aria-label={`Rank ${stage.rank}, ${stage.location}, coming soon`}
        aria-pressed={selected?.id === stage.id}
        onClick={() => setSelected(stage)}>
        <strong>{stage.rank} · {stage.location}</strong><small>Coming Soon</small>
      </button>)}
    </div>
    {selected && <p className="campaign-selection" role="status">Rank {selected.rank}: {selected.location} · {selected.opponent} · Coming Soon</p>}
  </main>;
}
