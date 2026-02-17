# GitHub Actions セットアップガイド

## ✅ 完了した設定

### 1. ワークフローファイル

#### backend-ci.yml
- ✅ Lint & Format Check（Black, Flake8, MyPy）
- ✅ テスト実行（pytest with coverage）
- ✅ PostgreSQL と Redis サービスの設定
- ✅ 環境変数の設定：
  - `DATABASE_URL`
  - `REDIS_URL`
  - `FIREBASE_PROJECT_ID` (secrets)
  - `FIREBASE_CLIENT_EMAIL` (secrets)
  - `FIREBASE_PRIVATE_KEY` (secrets)
  - `OPENAI_API_KEY` (secrets)
  - `WEATHER_API_KEY` (secrets)

#### frontend-ci.yml
- ✅ Lint Check（ESLint）
- ✅ Build Check（Next.js build）

#### deploy.yml
- ✅ デプロイ通知（手動デプロイ用）

### 2. コード修正

#### backend/app/services/ai_service.py
- ✅ OpenAI APIキーを環境変数から明示的に取得するように変更
- ✅ `OPENAI_API_KEY`が設定されていない場合にエラーを発生

## 📋 GitHub Secrets の設定確認

以下のSecretsがGitHubリポジトリに設定されていることを確認してください：

### 必須Secrets

1. ✅ **OPENAI_API_KEY** - OpenAI APIキー（取得済み）
2. ✅ **FIREBASE_PROJECT_ID** - FirebaseプロジェクトID（設定済み）
3. ✅ **FIREBASE_CLIENT_EMAIL** - Firebaseクライアントメール（設定済み）
4. ✅ **FIREBASE_PRIVATE_KEY** - Firebase秘密鍵（設定済み）
5. ⚠️ **WEATHER_API_KEY** - Weather APIキー（テストで使用、設定が必要）

### Secretsの設定方法

1. GitHubリポジトリにアクセス
2. Settings → Secrets and variables → Actions
3. "New repository secret" をクリック
4. 各Secretsを追加

## 🧪 テストの動作確認

### バックエンドテスト
- Weather APIのテストはモックを使用しているため、実際のAPIキーは不要
- ただし、エラーハンドリングのテストがあるため、`WEATHER_API_KEY`は設定が必要
- テストでは`test-api-key`というダミーキーを使用しているが、環境変数が設定されていないとエラーになる

### フロントエンドテスト
- 現在、フロントエンドにはテストファイルがない
- LintとBuildのみ実行

## 🚀 次のステップ

1. **WEATHER_API_KEYをGitHub Secretsに追加**
   - Weather APIのキーを取得して設定
   - または、テストでモックのみを使用する場合は、ダミーキーを設定

2. **ワークフローの動作確認**
   - `develop`ブランチまたは`main`ブランチにpushして動作確認
   - Actionsタブでワークフローの実行状況を確認

3. **必要に応じて追加設定**
   - Codecovへのカバレッジレポート送信（オプション）
   - 自動デプロイの設定（Vercel等）

## 📝 注意事項

- `WEATHER_API_KEY`はテストで使用されますが、実際のAPI呼び出しはモックされています
- エラーハンドリングのテストがあるため、環境変数は設定が必要です
- 実際のAPIキーがなくても、ダミーキー（例：`test-api-key`）を設定すればテストは通ります

