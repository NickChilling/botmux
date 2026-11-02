/** Durable, bot/chat/root-scoped provenance for explicitly addressed listener follow-ups. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteFileSync } from '../utils/atomic-write.js';

/** Verified Lark reply addressing; never inferred from quoted text or prompt content. */
export interface ListenerTopicReply {
  rootMessageId: string;
  explicitlyMentioned: boolean;
}

/** Extract a real group-thread reply from the received Lark envelope. */
export function listenerTopicReplyContext(
  message: { chat_type?: string; root_id?: string; thread_id?: string; message_id?: string },
  explicitlyMentioned: boolean,
): ListenerTopicReply | undefined {
  if (message.chat_type !== 'group' || !explicitlyMentioned
    || !message.thread_id || !message.root_id || message.root_id === message.message_id) return undefined;
  return { rootMessageId: message.root_id, explicitlyMentioned: true };
}

/** Resolve one constant-time provenance lookup without accepting path components from messages. */
function recordPath(dataDir: string, appId: string, chatId: string, rootId: string): string {
  const key = createHash('sha256').update(JSON.stringify([appId, chatId, rootId])).digest('hex');
  return join(dataDir, 'message-listener-topics', `${key}.json`);
}

/** Record a topic only after an owner-configured listener has admitted its seed. */
export function recordMessageListenerTopic(dataDir: string, appId: string, chatId: string, rootId: string): void {
  if (!appId || !chatId || !rootId) throw new Error('Listener topic identity is required');
  const path = recordPath(dataDir, appId, chatId, rootId);
  mkdirSync(join(dataDir, 'message-listener-topics'), { recursive: true });
  atomicWriteFileSync(path, JSON.stringify({ version: 1, appId, chatId, rootId }));
}

/** Read exact provenance, failing closed on missing, corrupt or mismatched records. */
export function isMessageListenerTopic(dataDir: string, appId: string, chatId: string, rootId: string): boolean {
  if (!appId || !chatId || !rootId) return false;
  try {
    const record: unknown = JSON.parse(readFileSync(recordPath(dataDir, appId, chatId, rootId), 'utf8'));
    return typeof record === 'object' && record !== null
      && 'version' in record && record.version === 1
      && 'appId' in record && record.appId === appId
      && 'chatId' in record && record.chatId === chatId
      && 'rootId' in record && record.rootId === rootId;
  } catch {
    return false;
  }
}
