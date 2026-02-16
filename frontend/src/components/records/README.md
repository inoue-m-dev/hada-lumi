/records は 3ファイル構成で整理しました👇

🧠 RecordsScreen.tsx
→ 記録画面の本体
→ 状態管理・API連携・保存/削除ロジックを担当

🎨 RecordForm.tsx
→ フォームUI専用
→ 状態は持たず、propsで受け取って表示するだけ

🎚 GradientSliderRow.tsx
→ 健康指標（1〜5）を入力するための共通スライダーUI
→ 色・ラベル・値表示を含む“意味付きスライダー”
