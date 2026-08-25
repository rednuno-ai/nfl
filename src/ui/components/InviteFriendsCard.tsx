import { useState } from "react";
import { useGameStore } from "@store/gameStore";
import { buildReferralLink } from "@data/auth";

/** "Convidar Amigos" section: every account gets a real, working referral
 *  link (?ref=CODE) that pre-fills the invited friend's registration and
 *  credits the referrer's count the moment they sign up — see
 *  src/data/auth.ts's `register()`. No fake counters: referralCount only
 *  ever goes up when someone genuinely registers through the link. */
export function InviteFriendsCard() {
  const currentUser = useGameStore((s) => s.currentUser);
  const [copied, setCopied] = useState(false);

  if (!currentUser) return null;

  const link = buildReferralLink(currentUser.referralCode);
  const shareMessage = `Estou a jogar NFL LIFE, um simulador de carreira de futebol americano do liceu ao Hall of Fame — junta-te com o meu link:`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browser, no permission);
      // the input below is still selectable/copyable by hand either way.
    }
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-title">Convida os Teus Amigos</div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Partilha o teu link e joga com os teus amigos. Sempre que alguém se registar através dele, conta para o teu
        total abaixo.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="field" style={{ flex: "1 1 260px", minWidth: 0, marginBottom: 0 }}>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button className="btn btn-primary" onClick={copyLink} type="button">
          {copied ? "Copiado! ✓" : "Copiar Link"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <a
          className="btn btn-ghost btn-sm"
          href={`https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${link}`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Partilhar no WhatsApp
        </a>
        <a
          className="btn btn-ghost btn-sm"
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(link)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Partilhar no X
        </a>
      </div>

      <p className="faint" style={{ fontSize: 12.5 }}>
        {currentUser.referralCount > 0
          ? currentUser.referralCount === 1
            ? "🎉 1 amigo já se registou através do teu link."
            : `🎉 ${currentUser.referralCount} amigos já se registaram através do teu link.`
          : "Ainda ninguém se registou pelo teu link — sê o primeiro a convidar alguém."}
        {" "}O teu código: <strong>{currentUser.referralCode}</strong>
      </p>
    </div>
  );
}
