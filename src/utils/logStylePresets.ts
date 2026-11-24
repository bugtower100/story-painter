import bubble from '~/assets/log-styles/sealchat-bubble.json'
import compact from '~/assets/log-styles/sealchat-compact.json'
import novel from '~/assets/log-styles/sealchat-novel.json'
import script from '~/assets/log-styles/sealchat-script.json'
import license from '~/assets/log-styles/LICENSE.txt?raw'
import type { LogStylePackage } from './logStyle'

// Unmodified SealChat packages; provenance and MIT notice are in assets/log-styles/README.md.
export const logStylePresets: LogStylePackage[] = [bubble, compact, novel, script]
export const sealChatStyleLicense = license
