import { useState } from "react";
import { useGameStore } from "@store/gameStore";
import { buildReferralLink } from "@data/auth";

/** "Invite Friends" section: every account gets a real, working referral
 *  link (?ref=CODE) that pre-fills the invited friend's registration and
 *  credits the referrer's count the moment they sign up — see
 *  src/data/auth.ts's `register()`. No fake counters: referralCount only
 *  ever goes up when someone genuinely registers through the link. */
export function InviteFriendsCard() {
  const currentUser = useGameStore((s) => s.currentUser);
  const [copied, setCopied] = useState(false);

  if (!currentUser) return null;

  const link = buildReferralLink(currentUser.referralCode);
  const shareMessage = `I'm playing NFL LIFE, a football career sim from high school to the Hall of Fame — join me with my link:`;

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
      <div className="section-title">Invite Your Friends</div>
      <p className="muted" style={{ marginBottom: 12 }}>
        Share your link and play with your friends. Every time someone registers through it, it counts toward your
        total below.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="field" style={{ flex: "1 1 260px", minWidth: 0, marginBottom: 0 }}>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button className="btn btn-primary" onClick={copyLink} type="button">
          {copied ? "Copied! ✓" : "Copy Link"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <a
          className="btn btn-ghost btn-sm"
          href={`https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${link}`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on WhatsApp
        </a>
        <a
          className="btn btn-ghost btn-sm"
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(link)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Share on X
        </a>
      </div>

      <p className="faint" style={{ fontSize: 12.5 }}>
        {currentUser.referralCount > 0
          ? currentUser.referralCount === 1
            ? "🎉 1 friend has registered through your link."
            : `🎉 ${currentUser.referralCount} friends have registered through your link.`
          : "No one has registered through your link yet — be the first to invite someone."}
        {" "}Your code: <strong>{currentUser.referralCode}</strong>
      </p>
    </div>
  );
}
