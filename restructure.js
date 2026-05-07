const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dirsToCreate = [
    "src/assets/images",
    "src/assets/icons",
    "src/assets/styles",
    "src/components/common",
    "src/components/layout",
    "src/components/animations",
    "src/features/auth",
    "src/features/chat/components",
    "src/features/chat/utils",
    "src/features/dashboard",
    "src/features/videoCall",
    "src/features/landing",
    "src/pages/public",
    "src/pages/protected",
    "src/pages/community",
    "src/pages/legal",
    "src/pages/docs",
    "src/lib/crypto",
    "src/lib/storage",
    "src/services/api",
    "src/services/socket",
    "src/services/webrtc",
    "src/hooks",
    "src/store",
    "src/utils/captions",
    "src/i18n/locales",
    "config/tests",
    "e2e/tests",
    "e2e/support",
    "e2e/fixtures"
];

dirsToCreate.forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
});

function gitMove(source, target) {
    if (fs.existsSync(source)) {
        try {
            console.log(`Moving ${source} to ${target}`);
            execSync(`git mv "${source}" "${target}"`, { stdio: 'inherit' });
        } catch (e) {
            console.error(`Failed to move ${source}: ${e.message}`);
        }
    } else {
        console.warn(`Source not found: ${source}`);
    }
}

function gitMoveContents(sourceDir, targetDir) {
    if (fs.existsSync(sourceDir)) {
        const items = fs.readdirSync(sourceDir);
        for (const item of items) {
            gitMove(path.join(sourceDir, item), targetDir);
        }
    } else {
        console.warn(`Directory not found: ${sourceDir}`);
    }
}

// Config & Root Level
gitMoveContents("vitest", "config/tests");
gitMove("e2e/auth.spec.ts", "e2e/tests/auth.spec.ts");
gitMove("e2e/chat.continuity.spec.ts", "e2e/tests/chat.continuity.spec.ts");
gitMove("e2e/chat.spec.ts", "e2e/tests/chat.spec.ts");
gitMove("e2e/helpers.ts", "e2e/support/helpers.ts");

// Assets & Styles
gitMove("src/App.css", "src/assets/styles/App.css");
gitMove("src/index.css", "src/assets/styles/index.css");
gitMove("src/theme.css", "src/assets/styles/theme.css");
gitMove("src/styles/SignIn.css", "src/assets/styles/SignIn.css");
gitMove("src/styles/Toast.css", "src/assets/styles/Toast.css");
gitMove("src/styles/UserProfile.css", "src/assets/styles/UserProfile.css");
gitMove("src/components/Dashboard/Dashboard.css", "src/features/dashboard/Dashboard.css");
gitMove("src/components/EchoChatWidget/EchoChatWidget.css", "src/features/chat/components/EchoChatWidget.css");
gitMove("src/components/Logo/logo.css", "src/assets/styles/logo.css");
gitMove("src/components/Logo/echo-logo.svg", "src/assets/icons/echo-logo.svg");
gitMove("src/components/Logo/sodaCan.svg", "src/assets/icons/sodaCan.svg");
gitMove("src/components/Logo/LogoComponent.jsx", "src/components/common/LogoComponent.jsx");

// Remove empty Logo dir
try { fs.rmdirSync("src/components/Logo"); } catch(e){}

// Lib / Core
gitMoveContents("src/components/Dashboard/Chat/utils/crypto", "src/lib/crypto");
gitMoveContents("src/utils/storage", "src/lib/storage");
gitMove("src/lib/crypto.js", "src/lib/crypto/index.js");
gitMoveContents("src/utils/opk", "src/lib/crypto");

// Auth
gitMove("src/components/Login.jsx", "src/features/auth/Login.jsx");
gitMove("src/components/Register.jsx", "src/features/auth/Register.jsx");
gitMoveContents("src/components/auth", "src/features/auth");

// VideoCall
gitMoveContents("src/components/VideoCall", "src/features/videoCall");

// Dashboard
gitMove("src/components/Dashboard/Dashboard.jsx", "src/features/dashboard/Dashboard.jsx");
gitMove("src/components/Dashboard/UserProfile.jsx", "src/features/dashboard/UserProfile.jsx");
gitMoveContents("src/components/Dashboard/DashboardComponents/Conversations", "src/features/dashboard");
gitMoveContents("src/components/Dashboard/DashboardComponents/Groups", "src/features/dashboard");

// Chat
gitMove("src/components/Dashboard/Chat/Chat.jsx", "src/features/chat/Chat.jsx");
gitMove("src/components/Dashboard/Chat/GroupChat.jsx", "src/features/chat/GroupChat.jsx");
gitMove("src/components/Dashboard/Chat/GroupChat.mls.test.jsx", "src/features/chat/GroupChat.mls.test.jsx");
gitMove("src/components/Dashboard/Chat/SafetyNumberModal.jsx", "src/features/chat/components/SafetyNumberModal.jsx");
gitMoveContents("src/components/Dashboard/Chat/MessageDisplay", "src/features/chat/components");
gitMoveContents("src/components/Dashboard/Chat/MessageInput", "src/features/chat/components");

// For Chat/utils, move specific ones avoiding crypto since it's already moved
const chatUtilsDir = "src/components/Dashboard/Chat/utils";
if (fs.existsSync(chatUtilsDir)) {
    const chatUtils = fs.readdirSync(chatUtilsDir);
    for (const item of chatUtils) {
        if (item !== "crypto") {
            gitMove(path.join(chatUtilsDir, item), "src/features/chat/utils");
        }
    }
}

// Landing
gitMoveContents("src/components/landing", "src/features/landing");
gitMove("src/components/EchoChatWidget/EchoChatWidget.jsx", "src/features/landing/EchoChatWidget.jsx"); // Move widget jsx here too

// Components Common & Layout
gitMoveContents("src/components/common", "src/components/common"); // This will just move contents of common to common? Wait, source and target are same. I'll just leave them there, or they are already in the right place, but wait `src/components/common` -> I don't need to move if they are already in `src/components/common`. I'll skip it.
// Wait, no need to move `src/components/common/*` to `src/components/common/` because they are already there! 

gitMove("src/components/HomepageComponents/HeroAnimation.jsx", "src/components/animations/HeroAnimation.jsx");
gitMove("src/components/HomepageComponents/ParticlesBackground.jsx", "src/components/animations/ParticlesBackground.jsx");
gitMove("src/components/HomepageComponents/WaveBackground.jsx", "src/components/animations/WaveBackground.jsx");
gitMove("src/components/HomepageComponents/Footer.jsx", "src/components/layout/Footer.jsx");
gitMove("src/components/HomepageComponents/Navbar.jsx", "src/components/layout/Navbar.jsx");
gitMove("src/components/HomepageComponents/Blog.jsx", "src/pages/public/Blog.jsx");
gitMove("src/components/HomepageComponents/Logo.jsx", "src/components/common/Logo.jsx");

gitMoveContents("src/components/Dashboard/DashboardComponents/Header", "src/components/layout");
gitMoveContents("src/components/Dashboard/DashboardComponents/Sidebar", "src/components/layout");

// Pages
gitMove("src/components/LandingPage.jsx", "src/pages/public/LandingPage.jsx");
gitMove("src/pages/Careers.jsx", "src/pages/public/Careers.jsx");
gitMove("src/pages/Demo.jsx", "src/pages/public/Demo.jsx");
gitMove("src/pages/Download.jsx", "src/pages/public/Download.jsx");
gitMove("src/pages/Pricing.jsx", "src/pages/public/Pricing.jsx");

gitMoveContents("src/pages/CommunityEvents", "src/pages/community");
gitMove("src/pages/Community.jsx", "src/pages/community/Community.jsx");

gitMoveContents("src/components/FooterComponents/Legal", "src/pages/legal");

gitMove("src/pages/Documentation.jsx", "src/pages/docs/Documentation.jsx");
gitMove("src/pages/APIPlayground.jsx", "src/pages/docs/APIPlayground.jsx");
gitMove("src/components/FooterComponents/Documentation.jsx", "src/pages/docs/DocumentationFooter.jsx"); // avoid overwrite

gitMove("src/components/UserProfile.jsx", "src/pages/protected/UserProfile.jsx");
gitMoveContents("src/components/Dashboard/Friends", "src/pages/protected");
gitMoveContents("src/components/Dashboard/Groups", "src/features/dashboard");
gitMoveContents("src/components/Dashboard/UserInfo", "src/features/dashboard");
gitMove("src/pages/Leaderboard.jsx", "src/pages/protected/Leaderboard.jsx");
gitMove("src/pages/Status.jsx", "src/pages/public/Status.jsx");
gitMove("src/pages/Roadmap.jsx", "src/pages/public/Roadmap.jsx");
gitMove("src/pages/Help.jsx", "src/pages/public/Help.jsx");

// Hooks
gitMoveContents("src/components/Dashboard/DashboardComponents/hooks", "src/hooks");

console.log("Restructure script executed.");
