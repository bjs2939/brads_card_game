export const COIN_FLIP_MS = 1000;

export default function MatchCoin({ flipping, tails }: { flipping: boolean; tails: boolean }) {
  const asset = flipping ? "coin-flip.gif" : tails ? "coin-tails.png" : "coin-heads.png";
  return <img key={asset} className="match-coin-toss" src={`${import.meta.env.BASE_URL}assets/effects/${asset}`} alt="" />;
}
