// Deterministic per-user accent color, used in group chats so a member's name
// color in the Group info panel matches the tint of their message bubbles in the
// conversation. The same userId always maps to the same hue, on every device,
// without any server round-trip — it's derived purely from the id string.

// Curated, well-spaced hues that all stay readable on the dark theme.
// (violet, pink, red, orange, amber, lime, green, teal, sky, blue, indigo, fuchsia)
const HUES = [262, 330, 2, 22, 42, 92, 142, 168, 199, 222, 248, 292]

const hashString = (value) => {
  const str = String(value ?? '')
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// Stable hue (0-360) for a given user id.
export const userHue = (userId) => HUES[hashString(userId) % HUES.length]

// Bright, readable name color on a dark background.
export const userColorName = (userId) => `hsl(${userHue(userId)}, 78%, 72%)`

// Border accent that matches the user's hue (for image bubbles).
export const userBorderColor = (userId) => `hsla(${userHue(userId)}, 65%, 58%, 0.45)`

// Translucent gradient + shadow for a message bubble, tinted to the user's hue.
// Mirrors the shape of the .bubble-sent / .bubble-received rules in index.css so
// it drops in as an inline-style override.
export const userBubbleStyle = (userId) => {
  const h = userHue(userId)
  return {
    background: `linear-gradient(135deg, hsla(${h}, 58%, 34%, 0.92), hsla(${h}, 54%, 26%, 0.92))`,
    boxShadow: `0 8px 24px -8px hsla(${h}, 60%, 22%, 0.6)`,
    color: '#fff',
  }
}
