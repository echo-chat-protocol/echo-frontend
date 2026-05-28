# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.0.13](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.11...v0.0.13) (2026-05-28)


### Features

* enhance user profile modal with improved data handling and UI updates ([391bad3](https://github.com/echo-chat-protocol/echo-frontend/commit/391bad31b558cb34db0b935ca91c2215f7f9c0e4))
* implement empty state component with animations and styling ([c434cc6](https://github.com/echo-chat-protocol/echo-frontend/commit/c434cc67224a8bf36c647b0c415e7cad5024201f))

## [0.0.12](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.11...v0.0.12) (2026-05-28)


### Features

* enhance user profile modal with improved data handling and UI updates ([391bad3](https://github.com/echo-chat-protocol/echo-frontend/commit/391bad31b558cb34db0b935ca91c2215f7f9c0e4))
* implement empty state component with animations and styling ([c434cc6](https://github.com/echo-chat-protocol/echo-frontend/commit/c434cc67224a8bf36c647b0c415e7cad5024201f))

## [0.0.11](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.8...v0.0.11) (2026-05-28)


### Features

* add basic QR transport ([97a9070](https://github.com/echo-chat-protocol/echo-frontend/commit/97a907078c36651897eaf6ae70d0126c93ccaf47))
* add responsive collapsible Sidebar component to dashboard layout ([0ec9674](https://github.com/echo-chat-protocol/echo-frontend/commit/0ec9674b339dd5f9862fd58da5f20230b2ba1902))
* added a code verification to device sync ([e07f339](https://github.com/echo-chat-protocol/echo-frontend/commit/e07f339be8235f5b55823b35531d2cc874dc4ba5))
* added global label file for all HKDF labels ([9e72785](https://github.com/echo-chat-protocol/echo-frontend/commit/9e72785d8257c318751080856b370f681b90d180))
* added synced devices tracking ([7008967](https://github.com/echo-chat-protocol/echo-frontend/commit/70089670e880c07ea4e3dae342639eda4027bb45))
* **auth:** migrate login & register from Socket.IO to REST API ([553c43e](https://github.com/echo-chat-protocol/echo-frontend/commit/553c43e993b81dfde14221790f2c28b1af367385))
* change X logo on footer ([47c9f11](https://github.com/echo-chat-protocol/echo-frontend/commit/47c9f11623406ca1d9a1f81351fb1e3aadd0143d))
* chat history and user info is encrypted and passed through QR ([3385908](https://github.com/echo-chat-protocol/echo-frontend/commit/3385908fa7d7ad7bd171003ad45e0ee2198e7a61))
* complete dashboard settings refactor, theme context integration, and UI cleanup ([f7565a0](https://github.com/echo-chat-protocol/echo-frontend/commit/f7565a0a65a8dec33e5496705975ba0af1d525ca))
* device sync create a device user and act as a seperate entity ([05fb124](https://github.com/echo-chat-protocol/echo-frontend/commit/05fb1240dd2b3f342ecd3f8787049d72c1fb7680))
* enhance UI grouping, group views, chat modal and fix MLS error feedback ([c2ebae7](https://github.com/echo-chat-protocol/echo-frontend/commit/c2ebae73ca1bed32ca87ea7a01487bc71892d7ac))
* implement core dashboard UI components, chat header, and theme context integration ([bce925e](https://github.com/echo-chat-protocol/echo-frontend/commit/bce925ea7f1c1f98fd08d4cc187275dfd46e0693))
* implement dashboard sidebar and global theme configuration ([9d15cd5](https://github.com/echo-chat-protocol/echo-frontend/commit/9d15cd54b970f0d85b74cbf9e390ebcd55745064))
* implement Footer component and CommunityPage landing page ([39d9432](https://github.com/echo-chat-protocol/echo-frontend/commit/39d9432a77960071060f257423805f560c1a62db))
* implement modular dashboard settings with theme customization and data export functionality ([20c2bd8](https://github.com/echo-chat-protocol/echo-frontend/commit/20c2bd85056c1a33f38802b1e2a6bc239670cc62))
* **services:** add REST API service layer for /api/v1 backend ([998e0bb](https://github.com/echo-chat-protocol/echo-frontend/commit/998e0bb737a6ec172b9f35817f060fcba60549c4))
* update documentation page ([7bad398](https://github.com/echo-chat-protocol/echo-frontend/commit/7bad39847218fda801e09d7960177ad63eb870f1))


### Bug Fixes

* 501 error fore vite url ([6403b3c](https://github.com/echo-chat-protocol/echo-frontend/commit/6403b3cc8349a44f3133f0904c18c71eed8d88a2))
* change database version ([4bd2489](https://github.com/echo-chat-protocol/echo-frontend/commit/4bd24899ea21844e4a0b7d2e08d68dcbb5b17e55))
* device sync list is bound to device status ([1de969e](https://github.com/echo-chat-protocol/echo-frontend/commit/1de969e04f00afb357b2e5445e811a17d8a9a90f))
* devices no longer expose sensitive data ([90cba3a](https://github.com/echo-chat-protocol/echo-frontend/commit/90cba3afc454d09fe315c1cdb90767f696afebe5))
* fixed device sync flow ([5f3b892](https://github.com/echo-chat-protocol/echo-frontend/commit/5f3b8925fac7e288599394c6a100f45fbff46d21))
* fixed read reciepts and message preview ([b4f3027](https://github.com/echo-chat-protocol/echo-frontend/commit/b4f30273d7f7e76dc9701b86616764ba86052b8e))
* group add removed member bug ([05e483a](https://github.com/echo-chat-protocol/echo-frontend/commit/05e483a82e441d507c06d3d33e9e34cc2a8d7f1e))
* group names and data is saved appropriately ([50c5c48](https://github.com/echo-chat-protocol/echo-frontend/commit/50c5c48882367a3c461aefaeb82f89d4679845c2))
* if device logs out, its removed from the device list ([9734f13](https://github.com/echo-chat-protocol/echo-frontend/commit/9734f133ec819833b020fa6e6109cb10d7558e8d))
* keep per-device messages in account level threads ([e855994](https://github.com/echo-chat-protocol/echo-frontend/commit/e855994753c425d7d82c6a21407f742efb4b8ae1))
* lint: import useEffect and include open in deps (CreateGroupModal) ([60d4b38](https://github.com/echo-chat-protocol/echo-frontend/commit/60d4b386e0a8051b30718544083a4f988829cd6c))
* local ip mismatch ([4b3ab17](https://github.com/echo-chat-protocol/echo-frontend/commit/4b3ab17bbdd4bd6907c491cf7099ea750d128558))
* overwrite settings sections ([030b0c9](https://github.com/echo-chat-protocol/echo-frontend/commit/030b0c9b73f2227031578d2f9150c4874231e573))
* partial MLS-DS remove member flow bug fix ([9da61f8](https://github.com/echo-chat-protocol/echo-frontend/commit/9da61f882f4e2c314afb13801b728f72b187a2e6))
* prefer lan adapter for device sync qr ([c700642](https://github.com/echo-chat-protocol/echo-frontend/commit/c700642917837bb081461bc64404f0b0098ea929))
* publish lan origin in device sync qr ([b92c31a](https://github.com/echo-chat-protocol/echo-frontend/commit/b92c31ac120e0192eea1bf0b85a2ab83d4071227))
* removed debug MLS option ([51dcf63](https://github.com/echo-chat-protocol/echo-frontend/commit/51dcf63e3d7dcf448031b01678a3fec283c688db))
* removed debug options ([4777516](https://github.com/echo-chat-protocol/echo-frontend/commit/4777516be6e86aade2432e028e0fc8d370881b23))
* **settings:** remove unused React imports from stubs ([73f3185](https://github.com/echo-chat-protocol/echo-frontend/commit/73f31855500f0673d79585cf3d1433ca453c764e))
* skipped out of order messages no longer corrupt DR chain ([eaef59a](https://github.com/echo-chat-protocol/echo-frontend/commit/eaef59abac30fb26f1978f454833737a89c9fb31))
* socket auth flow ([a0b5a2b](https://github.com/echo-chat-protocol/echo-frontend/commit/a0b5a2b9690c71a0192dbcae2295a8482fcf8f51))
* use frontend origin for device sync qr ([aaad3d1](https://github.com/echo-chat-protocol/echo-frontend/commit/aaad3d12304624f8eddec5ef7bc67c67ef27133a))

## [0.0.10](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.9...v0.0.10) (2026-05-25)


### Bug Fixes

* change database version ([4bd2489](https://github.com/echo-chat-protocol/echo-frontend/commit/4bd24899ea21844e4a0b7d2e08d68dcbb5b17e55))

## [0.0.9](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.8...v0.0.9) (2026-05-20)


### Features

* add responsive collapsible Sidebar component to dashboard layout ([0ec9674](https://github.com/echo-chat-protocol/echo-frontend/commit/0ec9674b339dd5f9862fd58da5f20230b2ba1902))
* added global label file for all HKDF labels ([9e72785](https://github.com/echo-chat-protocol/echo-frontend/commit/9e72785d8257c318751080856b370f681b90d180))
* **auth:** migrate login & register from Socket.IO to REST API ([553c43e](https://github.com/echo-chat-protocol/echo-frontend/commit/553c43e993b81dfde14221790f2c28b1af367385))
* change X logo on footer ([47c9f11](https://github.com/echo-chat-protocol/echo-frontend/commit/47c9f11623406ca1d9a1f81351fb1e3aadd0143d))
* complete dashboard settings refactor, theme context integration, and UI cleanup ([f7565a0](https://github.com/echo-chat-protocol/echo-frontend/commit/f7565a0a65a8dec33e5496705975ba0af1d525ca))
* enhance UI grouping, group views, chat modal and fix MLS error feedback ([c2ebae7](https://github.com/echo-chat-protocol/echo-frontend/commit/c2ebae73ca1bed32ca87ea7a01487bc71892d7ac))
* implement core dashboard UI components, chat header, and theme context integration ([bce925e](https://github.com/echo-chat-protocol/echo-frontend/commit/bce925ea7f1c1f98fd08d4cc187275dfd46e0693))
* implement dashboard sidebar and global theme configuration ([9d15cd5](https://github.com/echo-chat-protocol/echo-frontend/commit/9d15cd54b970f0d85b74cbf9e390ebcd55745064))
* implement Footer component and CommunityPage landing page ([39d9432](https://github.com/echo-chat-protocol/echo-frontend/commit/39d9432a77960071060f257423805f560c1a62db))
* implement modular dashboard settings with theme customization and data export functionality ([20c2bd8](https://github.com/echo-chat-protocol/echo-frontend/commit/20c2bd85056c1a33f38802b1e2a6bc239670cc62))
* **services:** add REST API service layer for /api/v1 backend ([998e0bb](https://github.com/echo-chat-protocol/echo-frontend/commit/998e0bb737a6ec172b9f35817f060fcba60549c4))


### Bug Fixes

* removed debug MLS option ([51dcf63](https://github.com/echo-chat-protocol/echo-frontend/commit/51dcf63e3d7dcf448031b01678a3fec283c688db))

## [0.0.8](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.6...v0.0.8) (2026-05-14)


### Features

* add public pages, routing config and core navigation map ([7eb5d39](https://github.com/echo-chat-protocol/echo-frontend/commit/7eb5d390487e89a9305af50b78031a9750939e5b))
* added periodical SPK rotation ([7cbe05d](https://github.com/echo-chat-protocol/echo-frontend/commit/7cbe05d8fa7bb0b68161b5848db83df791067ed1))
* **auth:** update login and register pages with real data and fixed links ([a175a79](https://github.com/echo-chat-protocol/echo-frontend/commit/a175a7958d4cfbd181ab0279e628341be8e3ae3d))
* completed the MLS-TreeKEM implementation with parent hash binding ([af2ba37](https://github.com/echo-chat-protocol/echo-frontend/commit/af2ba372d50b3171151c44be4deaad4e1acdf9de))
* implement brand-new luxury design system, landing page features, animations and core layout utilities ([747a963](https://github.com/echo-chat-protocol/echo-frontend/commit/747a9635379c04b7599977fd057cadd0281b205e))
* implement multi-language support (i18n) for Navbar and Hero with English and Spanish locales ([273802e](https://github.com/echo-chat-protocol/echo-frontend/commit/273802e98c4c2efa8f7ba5816731d5a38b13fac9))
* implement RFC 9180 HPKE and RFC 9420 group protocol improvements ([0bab3ba](https://github.com/echo-chat-protocol/echo-frontend/commit/0bab3baa4e59941141214e40e5e76881cfba69c3))
* initialize React root and render App component in index.js ([0fdee13](https://github.com/echo-chat-protocol/echo-frontend/commit/0fdee133b85e9beb65b38648a7cacd8a62a5582e))
* **landing:** update landing page data with real technical specifications and realistic samples ([9e5431c](https://github.com/echo-chat-protocol/echo-frontend/commit/9e5431cf461d1ec214825b8d559bcc8c122b0f69))
* modernize login and registration flows, merging real cryptographic logic into premium layouts ([8a285e1](https://github.com/echo-chat-protocol/echo-frontend/commit/8a285e191106bad97dfa9653498c90045e50d367))


### Bug Fixes

* deriveRootKey and continueDR use proper HKDF tags ([683e166](https://github.com/echo-chat-protocol/echo-frontend/commit/683e1667f58b3646dd47ce91a79d7c2e2c101ba1))
* epoch0Secret is now cleared whencreator recieves server ack ([b491b49](https://github.com/echo-chat-protocol/echo-frontend/commit/b491b498eefb0ae7735bbb1733af941a868c5d7b))
* fixed lint violation and removed dynamic import in commitFlow.js ([cf0712b](https://github.com/echo-chat-protocol/echo-frontend/commit/cf0712b2e037f77d32cccedcc705f994769271a9))
* removed vestigial call files ([c312fbc](https://github.com/echo-chat-protocol/echo-frontend/commit/c312fbc3a52889e8a76aafd01bcd6933675862a8))
* welcome messages are now signed by the senders leaf node ([c026150](https://github.com/echo-chat-protocol/echo-frontend/commit/c02615047ef85ba06560aafc66f85ea81a87af9a))

## [0.0.7](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.6...v0.0.7) (2026-05-13)


### Features

* add public pages, routing config and core navigation map ([7eb5d39](https://github.com/echo-chat-protocol/echo-frontend/commit/7eb5d390487e89a9305af50b78031a9750939e5b))
* added periodical SPK rotation ([7cbe05d](https://github.com/echo-chat-protocol/echo-frontend/commit/7cbe05d8fa7bb0b68161b5848db83df791067ed1))
* completed the MLS-TreeKEM implementation with parent hash binding ([af2ba37](https://github.com/echo-chat-protocol/echo-frontend/commit/af2ba372d50b3171151c44be4deaad4e1acdf9de))
* implement brand-new luxury design system, landing page features, animations and core layout utilities ([747a963](https://github.com/echo-chat-protocol/echo-frontend/commit/747a9635379c04b7599977fd057cadd0281b205e))
* implement multi-language support (i18n) for Navbar and Hero with English and Spanish locales ([273802e](https://github.com/echo-chat-protocol/echo-frontend/commit/273802e98c4c2efa8f7ba5816731d5a38b13fac9))
* implement RFC 9180 HPKE and RFC 9420 group protocol improvements ([0bab3ba](https://github.com/echo-chat-protocol/echo-frontend/commit/0bab3baa4e59941141214e40e5e76881cfba69c3))
* initialize React root and render App component in index.js ([0fdee13](https://github.com/echo-chat-protocol/echo-frontend/commit/0fdee133b85e9beb65b38648a7cacd8a62a5582e))
* modernize login and registration flows, merging real cryptographic logic into premium layouts ([8a285e1](https://github.com/echo-chat-protocol/echo-frontend/commit/8a285e191106bad97dfa9653498c90045e50d367))


### Bug Fixes

* deriveRootKey and continueDR use proper HKDF tags ([683e166](https://github.com/echo-chat-protocol/echo-frontend/commit/683e1667f58b3646dd47ce91a79d7c2e2c101ba1))
* epoch0Secret is now cleared whencreator recieves server ack ([b491b49](https://github.com/echo-chat-protocol/echo-frontend/commit/b491b498eefb0ae7735bbb1733af941a868c5d7b))
* fixed lint violation and removed dynamic import in commitFlow.js ([cf0712b](https://github.com/echo-chat-protocol/echo-frontend/commit/cf0712b2e037f77d32cccedcc705f994769271a9))
* removed vestigial call files ([c312fbc](https://github.com/echo-chat-protocol/echo-frontend/commit/c312fbc3a52889e8a76aafd01bcd6933675862a8))
* welcome messages are now signed by the senders leaf node ([c026150](https://github.com/echo-chat-protocol/echo-frontend/commit/c02615047ef85ba06560aafc66f85ea81a87af9a))

## [0.0.6](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.2...v0.0.6) (2026-04-29)


### Features

* add new wallpapers Echowallpaper and Echowallpaper2 ([fc57bbf](https://github.com/echo-chat-protocol/echo-frontend/commit/fc57bbf8c2c75ca0959204da3f6cda5f7138ba98))
* add terms agreement validation to registration process ([897c934](https://github.com/echo-chat-protocol/echo-frontend/commit/897c93446d01e4a0b80e7c23edc488051c62c285))
* enhance Login component with new design and improved user experience ([8393642](https://github.com/echo-chat-protocol/echo-frontend/commit/839364200ae6525ae361b0f3718ee33fbeb339b8))
* merge upstream/master into master ([09ff922](https://github.com/echo-chat-protocol/echo-frontend/commit/09ff92200304850cab151a15d9355176b16210a0))


### Bug Fixes

* added senderSigningPubKeyB64 into signature ([a5b857b](https://github.com/echo-chat-protocol/echo-frontend/commit/a5b857b5b406f83f8fd9e063c05108209c663154))
* added treePublicNodes into commit signature ([fb27ae9](https://github.com/echo-chat-protocol/echo-frontend/commit/fb27ae98665899590f40ba74488dacf6de4b662a))
* commit epoch should only equal epoch+1 ([1d47699](https://github.com/echo-chat-protocol/echo-frontend/commit/1d47699fe2d4ca1424612001ebb5e8267cdc6e4b))
* enhance registration form UI ([fd8fa5c](https://github.com/echo-chat-protocol/echo-frontend/commit/fd8fa5cf073a04146fa45434e735274894e81eaf))
* removed vestigial crypto files ([5391e68](https://github.com/echo-chat-protocol/echo-frontend/commit/5391e680760a6edf44fa7ff5070dd979a121c2ab))
* skipped mutation bled into state ([8bc77de](https://github.com/echo-chat-protocol/echo-frontend/commit/8bc77de866e093e91e4eba96c5434a0c85cda388))
* skippedDH test bug ([c91db54](https://github.com/echo-chat-protocol/echo-frontend/commit/c91db54b6f41cd4f4ac60ca4a071b8135cee06ca))
* update social media icon for Twitter to X ([706b7d7](https://github.com/echo-chat-protocol/echo-frontend/commit/706b7d7f2abf9c5158a9d47096ec468a1c42e7a2))

## [0.0.5](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.4...v0.0.5) (2026-04-22)


### Bug Fixes

* added treePublicNodes into commit signature ([fb27ae9](https://github.com/echo-chat-protocol/echo-frontend/commit/fb27ae98665899590f40ba74488dacf6de4b662a))
* commit epoch should only equal epoch+1 ([1d47699](https://github.com/echo-chat-protocol/echo-frontend/commit/1d47699fe2d4ca1424612001ebb5e8267cdc6e4b))

## [0.0.4](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.3...v0.0.4) (2026-04-20)


### Bug Fixes

* removed vestigial crypto files ([5391e68](https://github.com/echo-chat-protocol/echo-frontend/commit/5391e680760a6edf44fa7ff5070dd979a121c2ab))

## [0.0.3](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.2...v0.0.3) (2026-04-20)


### Features

* merge upstream/master into master ([09ff922](https://github.com/echo-chat-protocol/echo-frontend/commit/09ff92200304850cab151a15d9355176b16210a0))


### Bug Fixes

* skipped mutation bled into state ([8bc77de](https://github.com/echo-chat-protocol/echo-frontend/commit/8bc77de866e093e91e4eba96c5434a0c85cda388))
* skippedDH test bug ([c91db54](https://github.com/echo-chat-protocol/echo-frontend/commit/c91db54b6f41cd4f4ac60ca4a071b8135cee06ca))

## [0.0.2](https://github.com/echo-chat-protocol/echo-frontend/compare/v0.0.1...v0.0.2) (2026-04-12)

## 0.0.1 (2026-03-07)


### Bug Fixes

* rename blog.jsx to Blog.jsx to match component naming convention ([dd7ae0b](https://github.com/echo-chat-protocol/echo-frontend/commit/dd7ae0ba4f322bb7e92f31219513286c0502ea9e))
