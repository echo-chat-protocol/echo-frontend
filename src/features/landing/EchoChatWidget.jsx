import { useState, useRef, useEffect } from 'react'
import { X, Send, Minimize2, Maximize2, RotateCcw, ChevronLeft } from 'lucide-react'
import gsap from 'gsap'
import Logo from '@components/common/Logo'
import '@features/chat/components/EchoChatWidget.css'

/* FAQ DECISION TREE */
const FAQ = {
  root: {
    text: "Hi! I'm EchoBot Echo's support assistant. What can I help you with today?",
    options: [
      { label: 'Getting Started', next: 'getting_started' },
      { label: 'Security & Privacy', next: 'security' },
      { label: 'Account & Profile', next: 'account' },
      { label: 'Messages & Chats', next: 'messages' },
      { label: 'Calls', next: 'calls' },
      { label: 'Groups', next: 'groups' },
      { label: 'Notifications', next: 'notifications' },
      { label: 'Technical Issues', next: 'technical' },
      { label: 'Pricing & Plans', next: 'pricing' },
      { label: 'Contact Support', next: 'contact' },
    ],
  },

  /* Getting Started */
  getting_started: {
    text: 'What do you need help with to get started?',
    options: [
      { label: 'Create an account', next: 'gs_create' },
      { label: 'Add friends', next: 'gs_add_friends' },
      { label: 'Send my first message', next: 'gs_first_msg' },
      { label: 'Supported devices', next: 'gs_devices' },
      { label: 'Download the app', next: 'gs_download' },
      { label: 'Use Echo on the web', next: 'gs_web' },
    ],
  },
  gs_create: {
    text: 'To create an account:\n1. Visit echo.app or open the app.\n2. Tap Register.\n3. Enter your email and a secure password.\n4. Verify your email.\n5. Done! Your keys are generated automatically on your device.\n\nNo phone number or real name required.',
    options: [
      { label: 'Did not receive verification email', next: 'gs_no_email' },
      { label: 'Can I change my email later?', next: 'account_change_email' },
    ],
  },
  gs_no_email: {
    text: 'Try these steps:\n- Check your Spam/Junk folder.\n- Wait 5 minutes and refresh.\n- Make sure you typed the correct email.\n- Tap "Resend verification email" on the login page.\n\nStill nothing? Contact support@echo.app.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  gs_add_friends: {
    text: 'You can add friends in two ways:\n\nSearch by username - go to the Search tab and type their @username.\n\nShare invite link - in your profile, tap "Share invite link".\n\nOnce they accept, they appear in your contacts.',
    options: [
      { label: 'Friend cannot find me', next: 'gs_not_found' },
      { label: 'How do I set my username?', next: 'account_username' },
    ],
  },
  gs_not_found: {
    text: 'Make sure:\n- Your username is set (Settings > Profile > Username).\n- You have not restricted who can find you in Privacy settings.\n- They are searching your exact @username (case-insensitive).',
    options: [{ label: 'Privacy settings help', next: 'security_privacy_settings' }],
  },
  gs_first_msg: {
    text: 'Once you have added a friend:\n1. Tap their name in your contacts.\n2. Type your message in the input box.\n3. Hit Send.\n\nAll messages are end-to-end encrypted from the moment you hit send.',
    options: [
      { label: 'How does encryption work?', next: 'security_e2e' },
      { label: 'Can I send files?', next: 'messages_files' },
    ],
  },
  gs_devices: {
    text: 'Echo is available on:\n- Web browser (any modern browser)\n- Desktop: Windows, macOS, Linux (via Tauri)\n- Mobile: Android & iOS (coming soon)\n\nYour messages sync across all devices automatically.',
    options: [{ label: 'Download the app', next: 'gs_download' }],
  },
  gs_download: {
    text: 'Download Echo from:\n- echo.app/download - Windows / macOS / Linux\n- GitHub Releases - for advanced users\n- Web app - no download needed at echo.app\n\nMobile apps are coming soon!',
    options: [],
  },
  gs_web: {
    text: 'Yes! You can use Echo directly in your browser at echo.app with no installation required. All features including E2E encryption work in the web app.',
    options: [{ label: 'Is the web app secure?', next: 'security_web' }],
  },

  /* Security & Privacy */
  security: {
    text: 'What would you like to know about security and privacy?',
    options: [
      { label: 'How does E2E encryption work?', next: 'security_e2e' },
      { label: 'Can Echo read my messages?', next: 'security_read' },
      { label: 'Who can find me?', next: 'security_privacy_settings' },
      { label: 'What data do you collect?', next: 'security_data' },
      { label: 'How do I enable 2FA?', next: 'security_2fa' },
      { label: 'Is the web app secure?', next: 'security_web' },
      { label: 'How do I report abuse?', next: 'security_report' },
      { label: 'What is the Signal Protocol?', next: 'security_signal' },
    ],
  },
  security_e2e: {
    text: 'Echo uses end-to-end encryption powered by the Signal Protocol (X3DH + Double Ratchet).\n\nYour encryption keys are generated on your device and never leave it:\n- Only you and your recipient can read messages.\n- Even Echo servers cannot decrypt them.\n- If a server is compromised, your messages are still safe.',
    options: [
      { label: 'What is the Signal Protocol?', next: 'security_signal' },
      { label: 'Can Echo read my messages?', next: 'security_read' },
    ],
  },
  security_signal: {
    text: 'The Signal Protocol is the gold standard for secure messaging:\n\nX3DH (Extended Triple Diffie-Hellman) - establishes a shared secret without exchanging private keys.\n\nDouble Ratchet - evolves encryption keys with every single message, so one compromised key cannot decrypt past or future messages.\n\nIt is the same protocol used by WhatsApp and Signal.',
    options: [{ label: 'Can Echo read my messages?', next: 'security_read' }],
  },
  security_read: {
    text: 'No. Echo cannot read your messages. Your private keys are stored exclusively on your device.\n\nOur servers only relay encrypted ciphertext - we have no way to decrypt it. This is provable by design, not just policy.',
    options: [{ label: 'What data does Echo collect?', next: 'security_data' }],
  },
  security_data: {
    text: 'We collect only the minimum necessary:\n- Email address (for login)\n- Optional display name and avatar\n- Message delivery timestamps (not content)\n- Anonymous aggregated usage stats\n\nWe do NOT store message content, call audio/video, or your contact list.',
    options: [{ label: 'GDPR & my rights', next: 'security_gdpr' }],
  },
  security_gdpr: {
    text: 'Under GDPR you have the right to:\n- Access your data\n- Correct inaccurate data\n- Delete your account and all data\n- Export your data\n- Withdraw consent\n\nTo exercise these rights: Settings > Privacy or email dpo@echo.app.',
    options: [{ label: 'How do I delete my account?', next: 'account_delete' }],
  },
  security_privacy_settings: {
    text: 'Control who finds you in Settings > Privacy:\n- Who can find me by username: Everyone / Contacts Only / Nobody\n- Who can see my profile picture: Everyone / Contacts Only / Nobody\n- Read receipts: On / Off\n- Last seen: Everyone / Contacts Only / Nobody\n- Blocked users list',
    options: [{ label: 'How do I block someone?', next: 'messages_block' }],
  },
  security_2fa: {
    text: 'To enable two-factor authentication:\n1. Go to Settings > Security.\n2. Tap Two-Factor Authentication.\n3. Scan the QR code with an authenticator app.\n4. Enter the 6-digit code to confirm.\n\nYou will be asked for this code on each new login.',
    options: [{ label: 'I lost my 2FA code', next: 'security_2fa_lost' }],
  },
  security_2fa_lost: {
    text: 'If you lose access to your 2FA app:\n1. Use one of your backup codes (saved when you set up 2FA).\n2. If you have no backup codes, email security@echo.app from your registered address.\n\nWe will verify your identity and help you regain access.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  security_web: {
    text: "Yes. The web app uses the same E2E encryption as the desktop app. Keys are stored in your browser's Local Storage and never sent to our servers.\n\nWe recommend using a private/incognito window on shared computers.",
    options: [],
  },
  security_report: {
    text: 'To report abuse:\n- Open their profile > tap three dots > Report User.\n- For urgent safety issues email abuse@echo.app.\n\nAll reports are reviewed within 24 hours. You can also block the user immediately.',
    options: [{ label: 'How do I block someone?', next: 'messages_block' }],
  },

  /* Account */
  account: {
    text: 'What do you need help with regarding your account?',
    options: [
      { label: 'Change my username', next: 'account_username' },
      { label: 'Change my email', next: 'account_change_email' },
      { label: 'Change my password', next: 'account_password' },
      { label: 'Delete my account', next: 'account_delete' },
      { label: 'Update profile picture', next: 'account_avatar' },
      { label: 'Forgot my password', next: 'account_forgot_pw' },
      { label: 'Cannot log in', next: 'account_cant_login' },
    ],
  },
  account_username: {
    text: 'To change your username:\n1. Go to Settings > Profile.\n2. Tap your current username.\n3. Enter a new unique @username.\n4. Save changes.\n\nMust be 3-32 characters: letters, numbers, underscores only.',
    options: [],
  },
  account_change_email: {
    text: 'To change your email:\n1. Go to Settings > Account > Email.\n2. Enter your new email and current password.\n3. A verification link is sent to the new email.\n4. Click it to confirm the change.',
    options: [{ label: 'Did not receive the email', next: 'gs_no_email' }],
  },
  account_password: {
    text: 'To change your password:\n1. Go to Settings > Account > Security.\n2. Tap Change Password.\n3. Enter your current password, then your new password twice.\n4. Save.\n\nMinimum 8 characters.',
    options: [{ label: 'Forgot my password', next: 'account_forgot_pw' }],
  },
  account_forgot_pw: {
    text: 'To reset your password:\n1. Go to the Login page.\n2. Tap Forgot password?.\n3. Enter your registered email.\n4. Click the link we send you.\n5. Set a new password.\n\nThe link expires after 1 hour.',
    options: [
      { label: 'Did not receive the email', next: 'gs_no_email' },
      { label: 'Still cannot log in', next: 'account_cant_login' },
    ],
  },
  account_cant_login: {
    text: "Let's troubleshoot:\n- Check your email and password.\n- Have you verified your email? Check your inbox.\n- Using 2FA? You need your authenticator app.\n- Try resetting your password.\n- Clear your browser cache and cookies.",
    options: [
      { label: 'Reset password', next: 'account_forgot_pw' },
      { label: 'Lost my 2FA code', next: 'security_2fa_lost' },
      { label: 'Contact support', next: 'contact' },
    ],
  },
  account_delete: {
    text: 'Deleting your account is permanent and cannot be undone.\n\nTo delete:\n1. Go to Settings > Account.\n2. Scroll to Delete Account.\n3. Confirm your password.\n\nAll your messages, contacts, and keys are permanently erased.',
    options: [{ label: 'Contact support first', next: 'contact' }],
  },
  account_avatar: {
    text: 'To change your profile picture:\n1. Go to Settings > Profile.\n2. Tap your current avatar.\n3. Choose a photo from your device.\n4. Crop and save.\n\nProfile pictures are only visible to your contacts by default.',
    options: [],
  },

  /* Messages */
  messages: {
    text: 'What would you like to know about messages and chats?',
    options: [
      { label: 'Send files or images', next: 'messages_files' },
      { label: 'Delete messages', next: 'messages_delete' },
      { label: 'Edit sent messages', next: 'messages_edit' },
      { label: 'Read receipts', next: 'messages_receipts' },
      { label: 'Block someone', next: 'messages_block' },
      { label: 'Disappearing messages', next: 'messages_disappearing' },
      { label: 'Search messages', next: 'messages_search' },
      { label: 'Export chat history', next: 'messages_export' },
    ],
  },
  messages_files: {
    text: 'You can send:\n- Photos and videos (up to 100 MB)\n- Any file type (up to 100 MB)\n- Audio messages (tap the mic icon)\n- Location (tap the + button)\n\nAll files are end-to-end encrypted. Recipients can download them for up to 30 days.',
    options: [],
  },
  messages_delete: {
    text: 'To delete a message: long-press it and tap Delete.\n\n- Delete for me: removes it only from your view.\n- Delete for everyone: removes it from both sides (within 72 hours of sending).\n\nAfter 72 hours you can only delete for yourself.',
    options: [],
  },
  messages_edit: {
    text: 'Yes! You can edit sent messages within 15 minutes.\n\nLong-press your message and tap Edit. The message will show an Edited label and the recipient sees the edit history.',
    options: [],
  },
  messages_receipts: {
    text: 'Read receipts:\n- Single grey tick: sent\n- Double grey tick: delivered\n- Double violet tick: read\n\nBoth you and the other person can turn off read receipts in Settings > Privacy.',
    options: [{ label: 'Disable read receipts', next: 'security_privacy_settings' }],
  },
  messages_block: {
    text: 'To block a user:\n1. Open their profile.\n2. Tap three dots > Block.\n\nBlocked users cannot send you messages, see your last seen, or find you in search.\n\nTo unblock: Settings > Privacy > Blocked Users > Unblock.',
    options: [],
  },
  messages_disappearing: {
    text: 'Disappearing messages auto-delete after a set time.\n\nTo enable:\n1. Open a chat.\n2. Tap the contact name at the top.\n3. Tap Disappearing Messages.\n4. Choose: 5s / 1 min / 1 hour / 1 day / 1 week.\n\nMessages delete from both devices.',
    options: [],
  },
  messages_search: {
    text: 'To search messages:\n- Tap the search icon in your chat list to search all conversations.\n- Inside a chat, tap three dots > Search in chat to find messages in that conversation.',
    options: [],
  },
  messages_export: {
    text: 'To export chat history:\n1. Open a chat.\n2. Tap three dots > Export Chat.\n3. Choose with or without media.\n4. A .zip file is saved to your device.\n\nNote: exported files are not encrypted - keep them safe.',
    options: [],
  },

  /* Calls */
  calls: {
    text: 'What do you need help with for calls?',
    options: [
      { label: 'Make a voice call', next: 'calls_voice' },
      { label: 'Make a video call', next: 'calls_video' },
      { label: 'Are calls encrypted?', next: 'calls_encrypted' },
      { label: 'Poor call quality', next: 'calls_quality' },
      { label: 'Other person cannot hear me', next: 'calls_mic' },
      { label: 'Call non-Echo users?', next: 'calls_external' },
    ],
  },
  calls_voice: {
    text: 'To make a voice call:\n1. Open a chat with the contact.\n2. Tap the phone icon in the top right.\n3. Wait for them to answer.\n\nYou can also start a call directly from their profile.',
    options: [{ label: 'Are calls encrypted?', next: 'calls_encrypted' }],
  },
  calls_video: {
    text: 'To make a video call:\n1. Open a chat with the contact.\n2. Tap the video icon in the top right.\n3. Tap Start to call.\n\nYou can switch between front and rear cameras during a call.',
    options: [{ label: 'Are calls encrypted?', next: 'calls_encrypted' }],
  },
  calls_encrypted: {
    text: 'Yes. All Echo calls (voice and video) are end-to-end encrypted using SRTP + DTLS-SRTP. Nobody, including Echo, can eavesdrop on your calls.',
    options: [],
  },
  calls_quality: {
    text: 'Tips for better call quality:\n- You need at least 1 Mbps internet.\n- Move closer to your Wi-Fi router.\n- Close other bandwidth-heavy apps.\n- Switch between Wi-Fi and mobile data.\n- Restart the app.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  calls_mic: {
    text: 'If they cannot hear you:\n- Ensure Echo has microphone permission (device Settings > Apps > Echo > Permissions).\n- Check the call is not muted.\n- Try using headphones.\n- Restart the app or your device.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  calls_external: {
    text: 'Currently, Echo calls work only between Echo users. PSTN (regular phone number) calling is on our roadmap.',
    options: [],
  },

  /* Groups */
  groups: {
    text: 'What do you need help with for groups?',
    options: [
      { label: 'Create a group', next: 'groups_create' },
      { label: 'Add someone to a group', next: 'groups_add' },
      { label: 'Remove someone', next: 'groups_remove' },
      { label: 'Leave a group', next: 'groups_leave' },
      { label: 'Are group messages encrypted?', next: 'groups_encrypted' },
      { label: 'Group admin permissions', next: 'groups_admin' },
      { label: 'Group size limit', next: 'groups_limit' },
    ],
  },
  groups_create: {
    text: 'To create a group:\n1. In the chats list, tap the compose icon.\n2. Select New Group.\n3. Choose at least one contact.\n4. Set a group name and optional picture.\n5. Tap Create.\n\nYou become the admin automatically.',
    options: [],
  },
  groups_add: {
    text: 'To add someone to a group (admins only):\n1. Open the group chat.\n2. Tap the group name > Members.\n3. Tap + Add Member.\n4. Select contacts to add.\n\nThey will see all future messages but not past ones (forward secrecy).',
    options: [],
  },
  groups_remove: {
    text: 'To remove someone (admins only):\n1. Open the group chat.\n2. Tap the group name > Members.\n3. Long-press the member > Remove from group.\n\nThey are removed immediately and cannot see future messages.',
    options: [],
  },
  groups_leave: {
    text: 'To leave a group:\n1. Open the group chat.\n2. Tap the group name.\n3. Scroll to the bottom and tap Leave Group.\n\nIf you are the only admin, you need to promote someone first.',
    options: [],
  },
  groups_encrypted: {
    text: 'Yes. Group messages are end-to-end encrypted using the Sender Keys protocol (part of the Signal messaging layer). Each member holds keys and the server sees only ciphertext.',
    options: [],
  },
  groups_admin: {
    text: 'Group admins can:\n- Add and remove members\n- Edit group name and picture\n- Promote other members to admin\n- Delete messages for everyone\n\nA group can have multiple admins.',
    options: [],
  },
  groups_limit: {
    text: 'Groups can have up to 1,000 members. For larger communities, Channels (coming soon) will support unlimited subscribers.',
    options: [],
  },

  /* Notifications */
  notifications: {
    text: 'What do you need help with for notifications?',
    options: [
      { label: 'Not receiving notifications', next: 'notif_not_receiving' },
      { label: 'Mute a chat', next: 'notif_mute' },
      { label: 'Change notification sounds', next: 'notif_sounds' },
      { label: 'Enable or disable notifications', next: 'notif_toggle' },
      { label: 'Desktop notifications not working', next: 'notif_desktop' },
    ],
  },
  notif_not_receiving: {
    text: 'If you are not getting notifications:\n- Device settings: Settings > Apps > Echo > Notifications > Allow.\n- In Echo: Settings > Notifications > enabled.\n- Battery saver or Do Not Disturb can block notifications.\n- Make sure the app is not force-stopped.\n- Try reinstalling the app.',
    options: [
      { label: 'Desktop notifications not working', next: 'notif_desktop' },
      { label: 'Contact support', next: 'contact' },
    ],
  },
  notif_mute: {
    text: 'To mute a chat:\n1. Long-press the conversation in your chat list.\n2. Select Mute Notifications.\n3. Choose: 8 hours / 1 week / Always.\n\nOr inside the chat: tap the contact name > Mute.',
    options: [],
  },
  notif_sounds: {
    text: 'To change notification sounds:\n1. Go to Settings > Notifications.\n2. Tap Message Sound or Call Ringtone.\n3. Pick from the list or use a custom sound from your device.',
    options: [],
  },
  notif_toggle: {
    text: 'To toggle notifications:\n- All: Settings > Notifications > Enable Notifications.\n- Messages: Settings > Notifications > Messages.\n- Calls: Settings > Notifications > Calls.\n- Groups: Settings > Notifications > Groups.',
    options: [],
  },
  notif_desktop: {
    text: 'If desktop notifications are not working:\n1. Check browser/OS permission for echo.app.\n2. In your browser: Site Settings > Notifications > Allow.\n3. macOS/Windows: System Settings > Notifications > allow your browser or Echo.\n4. Try reloading the app.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },

  /* Technical */
  technical: {
    text: 'What kind of technical issue are you experiencing?',
    options: [
      { label: 'App crashes or will not open', next: 'tech_crash' },
      { label: 'Messages not sending', next: 'tech_not_sending' },
      { label: 'Messages not loading', next: 'tech_not_loading' },
      { label: 'Slow performance', next: 'tech_slow' },
      { label: 'Camera or mic not working', next: 'tech_camera_mic' },
      { label: 'Failed to connect error', next: 'tech_connect' },
      { label: 'Encryption key error', next: 'tech_key_error' },
      { label: 'How do I update the app?', next: 'tech_update' },
    ],
  },
  tech_crash: {
    text: 'Try these steps:\n1. Restart the app.\n2. Clear app cache (Settings > Apps > Echo > Clear Cache).\n3. Check for updates.\n4. Reinstall the app.\n5. Restart your device.\n\nIf the crash persists, email support@echo.app with a description of what you were doing.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  tech_not_sending: {
    text: 'If messages are not sending:\n- Check your internet connection.\n- Look for a warning icon next to the message and tap it to retry.\n- Make sure you have not been blocked.\n- Switch between Wi-Fi and mobile data.\n- Restart the app.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  tech_not_loading: {
    text: 'If messages are not loading:\n- Pull to refresh the chat list.\n- Check your internet connection.\n- Log out and log back in.\n- Clear app cache.\n- If media will not load, the file may have expired (media is stored 30 days).',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  tech_slow: {
    text: 'To improve performance:\n- Close background apps.\n- Clear the app cache.\n- Archive old chats.\n- Delete large media files from chats.\n- Check for app updates.\n- Free up device storage.',
    options: [],
  },
  tech_camera_mic: {
    text: 'If camera or mic is not working:\n1. Check permissions: device Settings > Apps > Echo > Permissions > enable Camera & Microphone.\n2. Close other apps using the camera or mic.\n3. Restart the app then your device.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  tech_connect: {
    text: '"Failed to connect" usually means:\n- Your internet is down.\n- Echo servers are temporarily down - check status.echo.app.\n- A firewall or VPN is blocking the connection.\n- Toggle airplane mode on then off.\n- Restart the app.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  tech_key_error: {
    text: 'An encryption key error can happen when using Echo on a new device for the first time.\n\nTo fix:\n1. Log out completely.\n2. Log back in - keys will be re-established automatically.\n\nIf it persists, contact support.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  tech_update: {
    text: 'To update Echo:\n- Web app: hard refresh (Ctrl+Shift+R / Cmd+Shift+R) - updates automatically.\n- Desktop: Help > Check for Updates, or re-download from echo.app/download.\n- Mobile (coming soon): update through App Store / Play Store.',
    options: [],
  },

  /* Pricing */
  pricing: {
    text: 'What would you like to know about pricing?',
    options: [
      { label: 'Is Echo free?', next: 'pricing_free' },
      { label: 'What is Echo Premium?', next: 'pricing_premium' },
      { label: 'What does Premium include?', next: 'pricing_premium_features' },
      { label: 'Cancel subscription', next: 'pricing_cancel' },
      { label: 'Student discount', next: 'pricing_discount' },
      { label: 'Team or enterprise plans', next: 'pricing_enterprise' },
    ],
  },
  pricing_free: {
    text: 'Yes! Echo is free with no ads. The free plan includes:\n- Unlimited end-to-end encrypted messages\n- Voice and video calls\n- Groups up to 1,000 members\n- 100 MB file sharing\n- Web, desktop, and mobile apps\n\nPremium features are optional extra convenience - the core experience is always free.',
    options: [{ label: 'What is Echo Premium?', next: 'pricing_premium' }],
  },
  pricing_premium: {
    text: 'Echo Premium is an optional subscription for power users. It does NOT improve your privacy or security - those are free for everyone.',
    options: [{ label: 'What does Premium include?', next: 'pricing_premium_features' }],
  },
  pricing_premium_features: {
    text: 'Echo Premium includes:\n- Extended cloud backup (up to 50 GB)\n- Larger file transfers (up to 2 GB)\n- Exclusive custom themes\n- Longer message edit window (60 min)\n- Custom username badges\n- Message analytics in groups\n- Priority support\n\nPricing: 4.99 EUR/month or 39.99 EUR/year.',
    options: [
      { label: 'How do I subscribe?', next: 'pricing_subscribe' },
      { label: 'Cancel subscription', next: 'pricing_cancel' },
    ],
  },
  pricing_subscribe: {
    text: 'To subscribe to Echo Premium:\n1. Go to Settings > Subscription.\n2. Tap Upgrade to Premium.\n3. Choose monthly or annual.\n4. Complete payment via Stripe (card, Apple Pay, Google Pay).',
    options: [{ label: 'Cancel subscription', next: 'pricing_cancel' }],
  },
  pricing_cancel: {
    text: 'To cancel your Premium subscription:\n1. Go to Settings > Subscription > Manage Subscription.\n2. Tap Cancel Subscription.\n\nYour Premium features remain until the end of the billing period.\n\nFor refund requests email billing@echo.app within 7 days of payment.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },
  pricing_discount: {
    text: 'We offer a 50% student discount on Echo Premium.\n\nTo apply:\n1. Email students@echo.app from your .edu email address.\n2. We will send you a discount code within 24 hours.',
    options: [],
  },
  pricing_enterprise: {
    text: 'Echo for Teams offers:\n- Centralized admin dashboard\n- SSO (Single Sign-On)\n- Custom data retention policies\n- Priority support and SLA\n- Volume pricing\n\nContact enterprise@echo.app for a quote.',
    options: [{ label: 'Contact support', next: 'contact' }],
  },

  /* Contact */
  contact: {
    text: 'How to reach us:\n\nGeneral support: support@echo.app\nPrivacy / DPO: dpo@echo.app\nBilling: billing@echo.app\nAbuse & Safety: abuse@echo.app\nEnterprise: enterprise@echo.app\n\nResponse time: within 24 hours on business days.\n\nContact form: echo.app/contact-us',
    options: [],
  },
}

/* KEYWORD ROUTING */
const KEYWORD_MAP = [
  { words: ['create account', 'register', 'sign up', 'signup'], node: 'gs_create' },
  { words: ['add friend', 'find user'], node: 'gs_add_friends' },
  { words: ['download', 'install'], node: 'gs_download' },
  { words: ['devices', 'platform', 'android', 'ios', 'mobile'], node: 'gs_devices' },
  { words: ['web app', 'browser'], node: 'gs_web' },
  { words: ['encrypt', 'e2e', 'end-to-end', 'signal protocol'], node: 'security_e2e' },
  { words: ['can you read', 'read my message'], node: 'security_read' },
  { words: ['data collect', 'what data'], node: 'security_data' },
  { words: ['2fa', 'two factor', 'authenticator'], node: 'security_2fa' },
  { words: ['block', 'report', 'abuse'], node: 'messages_block' },
  { words: ['gdpr', 'my rights', 'delete my data'], node: 'security_gdpr' },
  { words: ['username'], node: 'account_username' },
  { words: ['change email'], node: 'account_change_email' },
  { words: ['forgot password', 'reset password'], node: 'account_forgot_pw' },
  { words: ['change password'], node: 'account_password' },
  { words: ['delete account'], node: 'account_delete' },
  { words: ['profile picture', 'avatar', 'photo'], node: 'account_avatar' },
  { words: ['login', 'log in', 'cant login', 'cannot login'], node: 'account_cant_login' },
  { words: ['send file', 'image', 'attachment', 'media'], node: 'messages_files' },
  { words: ['delete message'], node: 'messages_delete' },
  { words: ['edit message'], node: 'messages_edit' },
  { words: ['disappear', 'self-destruct', 'auto delete'], node: 'messages_disappearing' },
  { words: ['read receipt', 'tick', 'checkmark'], node: 'messages_receipts' },
  { words: ['search message'], node: 'messages_search' },
  { words: ['export chat', 'backup'], node: 'messages_export' },
  { words: ['voice call', 'audio call'], node: 'calls_voice' },
  { words: ['video call', 'video chat'], node: 'calls_video' },
  { words: ['call quality', 'poor audio'], node: 'calls_quality' },
  { words: ['microphone', 'mic', 'cant hear'], node: 'calls_mic' },
  { words: ['create group'], node: 'groups_create' },
  { words: ['leave group'], node: 'groups_leave' },
  { words: ['group admin'], node: 'groups_admin' },
  { words: ['mute'], node: 'notif_mute' },
  { words: ['notification', 'notify'], node: 'notif_not_receiving' },
  { words: ['crash', 'wont open', 'not opening'], node: 'tech_crash' },
  { words: ['not sending', 'stuck', 'pending'], node: 'tech_not_sending' },
  { words: ['slow', 'lag', 'performance'], node: 'tech_slow' },
  { words: ['failed to connect', 'connection error'], node: 'tech_connect' },
  { words: ['update', 'new version'], node: 'tech_update' },
  { words: ['free', 'cost', 'price', 'how much'], node: 'pricing_free' },
  { words: ['premium', 'subscription'], node: 'pricing_premium' },
  { words: ['enterprise', 'team', 'business'], node: 'pricing_enterprise' },
  { words: ['student', 'discount'], node: 'pricing_discount' },
  { words: ['contact', 'support', 'help', 'email us'], node: 'contact' },
]

function resolveKeyword(text) {
  const lower = text.toLowerCase()
  for (const entry of KEYWORD_MAP) {
    if (entry.words.some((w) => lower.includes(w))) return entry.node
  }
  return null
}

/* COMPONENT */
const EchoChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [hasUnread, setHasUnread] = useState(true)
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: FAQ.root.text, options: FAQ.root.options },
  ])
  const [inputValue, setInputValue] = useState('')
  const [typing, setTyping] = useState(false)
  const [nodeHistory, setNodeHistory] = useState(['root'])
  const messagesEndRef = useRef(null)
  const widgetRef = useRef(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false)
      if (widgetRef.current) {
        gsap.fromTo(
          widgetRef.current,
          { opacity: 0, scale: 0.85, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'power2.out' }
        )
      }
    }
  }, [isOpen])

  const botReply = (nodeId, overrideHistory) => {
    setTyping(true)
    setTimeout(
      () => {
        const node = FAQ[nodeId] || FAQ.root
        const base = overrideHistory ?? nodeHistory
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), type: 'bot', text: node.text, options: node.options ?? [] },
        ])
        setNodeHistory([...base, nodeId])
        setTyping(false)
      },
      450 + Math.random() * 350
    )
  }

  const handleOptionChip = (opt) => {
    setMessages((prev) => [...prev, { id: Date.now(), type: 'user', text: opt.label }])
    botReply(opt.next)
  }

  const handleBack = () => {
    if (nodeHistory.length <= 1) return
    const newHistory = nodeHistory.slice(0, -1)
    const prevNode = newHistory[newHistory.length - 1]
    setNodeHistory(newHistory)
    const node = FAQ[prevNode] || FAQ.root
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), type: 'bot', text: node.text, options: node.options ?? [] },
    ])
  }

  const handleReset = () => {
    setMessages([{ id: Date.now(), type: 'bot', text: FAQ.root.text, options: FAQ.root.options }])
    setNodeHistory(['root'])
    setInputValue('')
  }

  const handleSend = (e) => {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || typing) return
    setMessages((prev) => [...prev, { id: Date.now(), type: 'user', text }])
    setInputValue('')
    const matched = resolveKeyword(text)
    if (matched) {
      botReply(matched)
    } else {
      setTyping(true)
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            type: 'bot',
            text: 'I did not find a clear match for that. Here are the main topics so you can find what you need:',
            options: FAQ.root.options,
          },
        ])
        setNodeHistory(['root'])
        setTyping(false)
      }, 700)
    }
  }

  const lastBotMsg = [...messages].reverse().find((m) => m.type === 'bot')

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className='fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 bg-violet-600 hover:bg-violet-500 text-white rounded-full shadow-[0_0_20px_rgba(124,58,237,0.5)] hover:shadow-[0_0_30px_rgba(124,58,237,0.7)] transition-all duration-300 group'
        >
          <div className='pointer-events-none absolute inset-0 rounded-full bg-violet-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300' />
          <Logo size='sm' variant='light' />
          {hasUnread && (
            <span className='absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.7)] animate-pulse'>
              1
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div
          ref={widgetRef}
          className='fixed bottom-6 right-6 z-50 w-96 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden'
          style={{ maxHeight: '560px' }}
        >
          <div className='flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10 flex-shrink-0'>
            <div className='flex items-center gap-3'>
              <Logo size='md' variant='light' />
              <div>
                <p className='text-sm font-semibold text-white leading-tight'>EchoBot</p>
                <p className='text-[11px] text-white/40 leading-tight'>Support assistant</p>
              </div>
            </div>
            <div className='flex items-center gap-1'>
              <button
                onClick={handleReset}
                title='Start over'
                className='p-1.5 hover:bg-white/10 rounded-lg transition-colors'
              >
                <RotateCcw className='w-3.5 h-3.5 text-white/40 hover:text-white/80' />
              </button>
              <button
                onClick={() => setIsMinimized((v) => !v)}
                className='p-1.5 hover:bg-white/10 rounded-lg transition-colors'
              >
                {isMinimized ? (
                  <Maximize2 className='w-3.5 h-3.5 text-white/40 hover:text-white/80' />
                ) : (
                  <Minimize2 className='w-3.5 h-3.5 text-white/40 hover:text-white/80' />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className='p-1.5 hover:bg-white/10 rounded-lg transition-colors'
              >
                <X className='w-3.5 h-3.5 text-white/40 hover:text-white/80' />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className='flex-1 overflow-y-auto p-4 space-y-3 echo-chat-messages'>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}
                  >
                    <div
                      className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.type === 'user'
                          ? 'bg-violet-600 text-white rounded-br-sm'
                          : 'bg-white/[0.07] text-white/85 border border-white/10 rounded-bl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {!typing && lastBotMsg?.options?.length > 0 && (
                  <div className='flex flex-wrap gap-2 mt-1 animate-slideUp'>
                    {nodeHistory.length > 1 && (
                      <button
                        onClick={handleBack}
                        className='flex items-center gap-1 text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 rounded-full border border-white/10 transition-colors'
                      >
                        <ChevronLeft className='w-3 h-3' /> Back
                      </button>
                    )}
                    {lastBotMsg.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleOptionChip(opt)}
                        className='text-xs px-3 py-1.5 bg-white/5 hover:bg-violet-600/30 text-violet-300 hover:text-white rounded-full border border-violet-500/20 hover:border-violet-500/50 transition-all'
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {typing && (
                  <div className='flex justify-start animate-slideUp'>
                    <div className='bg-white/[0.07] border border-white/10 px-4 py-3 rounded-2xl rounded-bl-sm'>
                      <div className='flex gap-1.5 items-center'>
                        <div className='w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce' />
                        <div className='w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce delay-100' />
                        <div className='w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce delay-200' />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={handleSend}
                className='flex items-center gap-2 px-3 py-3 border-t border-white/10 flex-shrink-0 bg-black/40'
              >
                <input
                  type='text'
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder='Type a question'
                  className='flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all'
                />
                <button
                  type='submit'
                  disabled={!inputValue.trim() || typing}
                  className='p-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-colors'
                >
                  <Send className='w-4 h-4' />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default EchoChatWidget
