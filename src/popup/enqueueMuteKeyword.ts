// PopupからService Workerへ、ミュートキーワード追加の受付のみを依頼する。
// 検証・キュー投入が完了した時点ですぐ返る応答を返すだけで、
// X側への保存完了（実処理）は待たない。
import type { EnqueueResult } from '../background/muteQueue'

export const enqueueMuteKeyword = (keyword: string): Promise<EnqueueResult> =>
  chrome.runtime.sendMessage({ action: 'enqueueMuteKeyword', keyword }) as Promise<EnqueueResult>
