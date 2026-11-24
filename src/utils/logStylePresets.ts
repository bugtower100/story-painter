import bubble from '~/assets/log-styles/sealchat-bubble.json'
import compact from '~/assets/log-styles/sealchat-compact.json'
import novel from '~/assets/log-styles/sealchat-novel.json'
import script from '~/assets/log-styles/sealchat-script.json'
import dossier from '~/assets/log-styles/sealchat-dossier.json'
import terminal from '~/assets/log-styles/sealchat-terminal.json'
import starter from '~/assets/log-styles/starter.json'
import license from '~/assets/log-styles/LICENSE.txt?raw'
import type { LogStylePackage } from './logStyle'

// Unmodified SealChat packages; provenance and MIT notice are in assets/log-styles/README.md.
export const logStylePresets: LogStylePackage[] = [bubble, compact, script, novel, dossier, terminal, starter]
export const sealChatStyleLicense = license
