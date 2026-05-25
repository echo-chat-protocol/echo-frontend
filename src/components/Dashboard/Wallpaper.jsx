/**
 * Wallpaper layer for the chat thread area.
 * Driven by the .echo-wallpaper CSS class in index.css.
 */
export default function Wallpaper({ className = '' }) {
  return <div aria-hidden className={`echo-wallpaper ${className}`} />
}
