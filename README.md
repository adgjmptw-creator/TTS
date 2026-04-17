# ながら読み上げ / Listen On-the-Go

ブラウザで動くシンプルなテキスト読み上げ (Text-to-Speech) アプリです。
論文や AI が要約したレポートを貼り付けて、移動中に「ながら聞き」するために作られています。

A simple browser-based text-to-speech reader. Paste a paper or an AI-generated
report, hit play, and listen on the go.

## 特徴 / Features

- **貼り付けて再生**: 大きなテキストエリアに貼り付けるだけ
- **日本語 / 英語対応**: テキスト言語を自動判定し、端末のローカル音声を選択
- **速度 / ピッチ調整**: 0.5x 〜 2.0x の範囲で自由に変更
- **ネット切断に強い**:
  - 端末にインストールされたオフライン音声のみを使用
  - テキストを文単位で分割して再生（Chrome の長文バグ回避も兼ねる）
  - 再生位置を自動保存。リロードしても続きから再生
  - Service Worker でアプリ本体をキャッシュ、圏外でも起動可
- **PWA**: ホーム画面に追加してアプリのように利用可能
- **ショートカット**: `Space` = 再生/一時停止、`←` / `→` = 文スキップ
- **ダークモード**: OS 設定に追従
- **外部依存なし**: フレームワークもビルドも不要のプレーン HTML/CSS/JS

## ローカル起動

```bash
# リポジトリをクローンしたあとで
python3 -m http.server 8000
# http://localhost:8000/ を開く
```

`file://` で直接開くと Service Worker が動きません。必ず HTTP サーバー経由で起動してください。

## GitHub Pages へのデプロイ

1. このリポジトリを GitHub へ push
2. GitHub のリポジトリ画面で **Settings → Pages** を開く
3. **Source** を `Deploy from a branch` にし、公開したいブランチ（`main` など）と `/ (root)` を選択
4. **Save** で有効化。数十秒後に `https://<user>.github.io/<repo>/` で公開される

初回アクセス時に Service Worker がアプリ本体をキャッシュするため、2 回目以降はオフラインでも起動できます。

## 動作環境

| プラットフォーム | 備考 |
|---|---|
| Chrome / Edge (Desktop) | OS インストール済みのローカル音声を使用 |
| Safari (macOS / iOS) | iOS はユーザー操作（ボタン押下）で再生開始 |
| Android Chrome | Android TTS エンジンのローカル音声を使用 |

端末に日本語・英語の TTS ボイスがインストールされている必要があります。
- **iOS / macOS**: 設定 → アクセシビリティ → 読み上げコンテンツ → 声
- **Android**: 設定 → システム → 言語と入力 → テキスト読み上げ
- **Windows**: 設定 → 時刻と言語 → 音声認識 → 音声の管理

## ファイル構成

```
/
├── index.html              # UI
├── styles.css              # スタイル
├── app.js                  # UI 制御
├── tts.js                  # 読み上げエンジン
├── i18n.js                 # 日本語 / 英語辞書
├── storage.js              # localStorage ラッパ
├── sw.js                   # Service Worker
├── manifest.webmanifest    # PWA マニフェスト
└── icons/                  # アプリアイコン (SVG)
```

## ライセンス

MIT
