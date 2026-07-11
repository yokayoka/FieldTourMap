# Field Tour

地理学・地質学の野外教育向けWebGISアプリ。スマートフォンで運用でき、GNSSによる現在地表示、Leafletベースの複数レイヤー切替、見学ポイント（POI）ごとの写真・動画・参考文献リンク表示、観察メモの記録、オフラインタイルキャッシュ、URL共有機能、複数実習ツアーの切替に対応する。GitHub Pagesの静的ホスティングのみで動作する。

- 本番環境: https://yokayoka.github.io/FieldTourMap/

## ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [requirements.md](./requirements.md) | 要件定義（ユーザーストーリー・受け入れ基準） |
| [design.md](./design.md) | アーキテクチャ・コンポーネント設計・データスキーマ |
| [task.md](./task.md) | 実装計画・進捗・各タスクの完了メモ（発見した不具合・設計判断の記録） |
| [SECURITY.md](./SECURITY.md) | セキュリティ・プライバシー方針 |
| [docs/organizer-guide.md](./docs/organizer-guide.md) | 主催者向け: Admin Config Toolの使い方、設定反映の手順 |
| [docs/developer-guide.md](./docs/developer-guide.md) | 開発者向け: 環境構築・テスト・デプロイ手順 |

## クイックスタート

```
npm install
npm run dev
```

詳細は[開発者向けガイド](./docs/developer-guide.md)を参照。
