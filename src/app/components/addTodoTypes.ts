// app/components/addTodoTypes.ts
/**
 * このファイルの役割
 * - AddTodoForm 周辺で共有する型定義をまとめるモジュール
 * - 「フォーム上では number | "" で扱う」などの型ポリシーを1箇所に集約する
 *
 * 設計方針
 * - HTML の <input type="number"> が空文字も扱う仕様に合わせて、
 *   フォーム内の数値入力は「number | ""」に統一する。
 * - Firestore に保存するときだけ number | null に正規化する。
 *
 * 関連コンポーネント
 * - AddTodoForm
 * - SingleTaskForm
 * - MultiTaskForm
 */

/**
 * フォーム内での minutes 入力用の型
 * - HTML input の仕様上、空欄は "" になるため number | "" としている。
 * - 「空欄＝未設定」という意味を持たせる。
 */
export type EstimatedMinInput = number | "";

/**
 * 単一タスク用フォームの状態型
 * - 画面上の入力値（文字列や number | ""）をそのまま保持する。
 */
export type SingleForm = {
  title: string;
  date: string; // YYYY-MM-DD
  estimatedMin: EstimatedMinInput;
  folder: string;
};

/**
 * 複数タスク用のサブタスク型
 * - id は UI 上のキー用にだけ使うので string。
 * - date は未指定もありうるのでオプション。
 */
export type SubTask = {
  id: string;
  title: string;
  date?: string;
  estimatedMin: EstimatedMinInput;
};
