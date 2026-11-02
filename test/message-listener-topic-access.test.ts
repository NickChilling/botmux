/** Behavioral checks for durable listener-topic provenance and authentic reply addressing. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMessageListenerTopic, listenerTopicReplyContext, recordMessageListenerTopic } from '../src/services/message-listener-topic-access.js';

describe('message listener topic provenance', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'listener-topics-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('retains exact bot/chat/root provenance on disk without a session or in-memory grant', () => {
    recordMessageListenerTopic(dir, 'app_a', 'oc_a', 'om_a');
    expect(isMessageListenerTopic(dir, 'app_a', 'oc_a', 'om_a')).toBe(true);
    expect(isMessageListenerTopic(dir, 'app_b', 'oc_a', 'om_a')).toBe(false);
    expect(isMessageListenerTopic(dir, 'app_a', 'oc_b', 'om_a')).toBe(false);
    expect(isMessageListenerTopic(dir, 'app_a', 'oc_a', 'om_b')).toBe(false);
    recordMessageListenerTopic(dir, 'app_a', 'oc_a', 'om_a');
    expect(readdirSync(join(dir, 'message-listener-topics'))).toHaveLength(1);
  });

  it('rejects corrupt or identity-mismatched provenance', () => {
    recordMessageListenerTopic(dir, 'app_a', 'oc_a', 'om_a');
    const path = join(dir, 'message-listener-topics', readdirSync(join(dir, 'message-listener-topics'))[0]);
    writeFileSync(path, '{');
    expect(isMessageListenerTopic(dir, 'app_a', 'oc_a', 'om_a')).toBe(false);
    writeFileSync(path, JSON.stringify({ version: 1, appId: 'app_b', chatId: 'oc_a', rootId: 'om_a' }));
    expect(isMessageListenerTopic(dir, 'app_a', 'oc_a', 'om_a')).toBe(false);
  });

  it('requires an explicit mention inside a real group thread, excluding quote bubbles and seeds', () => {
    const reply = { chat_type: 'group', message_id: 'om_reply', root_id: 'om_root', thread_id: 'omt_topic' };
    expect(listenerTopicReplyContext(reply, true)).toEqual({ rootMessageId: 'om_root', explicitlyMentioned: true });
    expect(listenerTopicReplyContext(reply, false)).toBeUndefined();
    expect(listenerTopicReplyContext({ ...reply, thread_id: undefined }, true)).toBeUndefined();
    expect(listenerTopicReplyContext({ ...reply, root_id: undefined }, true)).toBeUndefined();
    expect(listenerTopicReplyContext({ ...reply, message_id: 'om_root' }, true)).toBeUndefined();
    expect(listenerTopicReplyContext({ ...reply, chat_type: 'p2p' }, true)).toBeUndefined();
  });
});
