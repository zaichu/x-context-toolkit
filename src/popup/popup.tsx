// ポップアップエントリーポイント
import { createRoot } from 'react-dom/client'
import { Popup } from './Popup'
import 'bootstrap/dist/css/bootstrap.min.css'

// DOM要素を取得してReactアプリをマウント
const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<Popup />)
}
