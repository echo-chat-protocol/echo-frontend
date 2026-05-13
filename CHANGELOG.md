# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

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
