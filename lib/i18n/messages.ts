import { mergeMessages, type Messages } from './index'
import { shellMessages } from './dicts/shell'
import { sharedMessages } from './dicts/shared'
import { adminMessages } from './dicts/admin'
import { superadminMessages } from './dicts/superadmin'
import { agentMessages } from './dicts/agent'
import { authMessages } from './dicts/auth'

export const allMessages: Messages = mergeMessages(
  shellMessages,
  sharedMessages,
  adminMessages,
  superadminMessages,
  agentMessages,
  authMessages
)
