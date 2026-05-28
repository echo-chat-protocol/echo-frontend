/**
 * Shared test fixtures and constants for E2E tests.
 * Centralizes test data to avoid duplication and ensure consistency.
 */

/**
 * Common password used across tests.
 * Strong enough to pass all validation rules.
 */
export const TEST_PASSWORD = "Testpass1!";

/**
 * Common timeouts used across tests (in milliseconds).
 */
export const TIMEOUTS = {
  /** Short operations (UI updates, quick validations) */
  SHORT: 5_000,
  /** Medium operations (registration, login) */
  MEDIUM: 15_000,
  /** Long operations (message delivery, ELD unlock) */
  LONG: 60_000,
  /** Very long operations (chat continuity tests with multiple messages) */
  VERY_LONG: 180_000,
} as const;

/**
 * Test IDs used in the application for easy element selection.
 * Maps logical components to their test IDs.
 */
export const TEST_IDS = {
  // Navigation and sidebar
  NAV_FRIENDS: "nav-friends",
  NAV_SETTINGS: "nav-settings",
  NAV_ABOUT: "nav-about",

  // Dashboard
  DASHBOARD_SEARCH: "dashboard-search",
  DASHBOARD_CONTAINER: "dashboard-container",

  // Chat
  CHAT_INPUT: "chat-input",
  CHAT_SEND: "chat-send",
  CHAT_MESSAGE: "chat-message",
  CHAT_CONTAINER: "chat-container",

  // Friends/Contacts
  FRIEND_RESULT: "friend-result",
  FRIEND_LIST_ITEM: "friend-list-item",
  FRIEND_REQUEST_ITEM: "friend-request-item",

  // ELD (Encrypted Local Database)
  ELD_PASSWORD_INPUT: "eld-password-input",

  // Forms
  USERNAME_INPUT: "username-input",
  PASSWORD_INPUT: "password-input",
  CONFIRM_PASSWORD_INPUT: "confirm-password-input",
} as const;

/**
 * Form input selectors (CSS or XPath).
 * Used when test IDs are not available.
 */
export const SELECTORS = {
  USERNAME_INPUT: "#username",
  PASSWORD_INPUT: "#password",
  CONFIRM_PASSWORD_INPUT: "#confirmPassword",
  ELD_PASSWORD_INPUT: "#eld-password",
  CREATE_ACCOUNT_BUTTON: 'button:has-text("Create Account")',
  SIGN_IN_BUTTON: 'button:has-text("Sign In")',
  UNLOCK_BUTTON: 'button:has-text("Unlock")',
} as const;

/**
 * Page URLs used in tests.
 */
export const PAGES = {
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  SETTINGS: "/settings",
} as const;

/**
 * Common test data patterns.
 */
export const TEST_DATA = {
  /** Sample message templates */
  MESSAGES: {
    HELLO: (timestamp: number = Date.now()) => `hello-${timestamp}`,
    PERSIST_TEST: (timestamp: number = Date.now()) => `e2e-persist-${timestamp}`,
    AFTER_RELOAD: (timestamp: number = Date.now()) => `e2e-after-reload-${timestamp}`,
    NUMBERED: (prefix: string, index: number, timestamp: number = Date.now()) => 
      `${prefix}-${timestamp}-${index}`,
  },

  /** User name patterns */
  USERS: {
    ALICE: "alice",
    BOB: "bob",
    CHARLIE: "charlie",
  },
} as const;

/**
 * Browser context options for parallel test execution.
 * Each context is isolated (cookies, storage, etc.).
 */
export const BROWSER_CONTEXT_OPTIONS = {
  /** Context 1: For primary user */
  PRIMARY: {},
  /** Context 2: For secondary user */
  SECONDARY: {},
  /** Context 3: For tertiary user (if needed for group chats) */
  TERTIARY: {},
} as const;

/**
 * Default test configuration.
 */
export const TEST_CONFIG = {
  /** Set to true to see browser UI during tests (for debugging) */
  DEBUG_HEADED: false,
  
  /** Set to true to see slowdown in browser (for debugging) */
  DEBUG_SLOW_MO: 0, // milliseconds
  
  /** Default timeout for individual operations */
  DEFAULT_TIMEOUT: TIMEOUTS.LONG,

  /** Enable verbose logging in helpers */
  VERBOSE_LOGGING: false,
} as const;

/**
 * Alert/notification messages that tests expect.
 */
export const EXPECTED_MESSAGES = {
  REGISTRATION_SUCCESS: "Registration successful",
  LOGIN_SUCCESS: /Dashboard|chat/i,
  UNLOCK_SUCCESS: /Dashboard|Friends|Chat/i,
} as const;

/**
 * Error messages that indicate test failures.
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: /network|connection|failed|timeout/i,
  AUTH_ERROR: /unauthorized|invalid|forbidden/i,
  VALIDATION_ERROR: /required|invalid|must|error/i,
} as const;

/**
 * Message delays for realistic user interaction.
 * Uses these to slow down test execution for better observability.
 */
export const DELAYS = {
  /** Very short delay (UI feels instant) */
  INSTANT: 100,
  /** Short delay (user typing) */
  SHORT: 300,
  /** Medium delay (user thinking) */
  MEDIUM: 600,
  /** Long delay (waiting for server response) */
  LONG: 1_000,
} as const;
