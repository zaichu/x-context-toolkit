// PopupからService Workerへ、ミュートキーワード追加の受付のみを依頼する。
// 検証・キュー投入が完了した時点ですぐ返る応答を返すだけで、
// X側への保存完了（実処理）は待たない。

export interface EnqueueMuteKeywordResponse {
  accepted: boolean
  deduplicated?: boolean
  error?: string
}

export const enqueueMuteKeyword = (keyword: string): Promise<EnqueueMuteKeywordResponse> =>
  chrome.runtime.sendMessage({ action: 'enqueueMuteKeyword', keyword }) as Promise<EnqueueMuteKeywordResponse>
