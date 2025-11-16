// src/app/calender/page.tsx
/**
 * このファイルの役割
 * - 「月表示カレンダー + その日のざっくり TODO 一覧 + 下部 DayView」のページコンポーネント。
 * - Firestore の plans コレクションから、date="YYYY-MM-DD" 形式でタスクを集計し、
 *   月単位の概要と、選択した1日の詳細 (DayView) を組み合わせて表示する。
 *
 * 設計方針
 * - このコンポーネントは「ページコンテナ」として
 *   - Firestore からのデータ取得＆集計
 *   - 月・選択日の状態管理
 *   - DayView との日付同期（DayView で日付変更 ⇒ カレンダー側も追随）
 *   に集中させる。
 * - カレンダー表示のロジックはできるだけ小さなユーティリティ関数 (formatDateYYYYMMDD, getDaysInMonth など)
 *   に分割し、処理の意図をコメントで明示する。
 *
 * 関連コンポーネント / モジュール
 * - src/app/components/DayView
 *   - 選択した1日の TODO 詳細を表示するコンポーネント。
 *   - initialDate / onDateChange でこのページと日付を同期する。
 */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import DayView from "../components/DayView";

// ---- 型定義 -------------------------------------------------------------------

/**
 * 1日のタスクざっくり情報（カレンダーセルに表示するための要約）
 */
type DaySummary = {
  date: string;      // "YYYY-MM-DD"
  total: number;     // その日のタスク総数
  done: number;      // 完了タスク数
  titles: string[];  // カレンダーセルに載せるタイトル（先頭数件に絞る）
};

/**
 * カレンダーセル（1日分）の描画用情報
 * - dateStr が null のセルは「当月の前後を埋める空セル（グレーアウト）」として扱う。
 */
type CalendarCell = {
  dateStr: string | null;
  dayNumber: number | null;
};

// ---- 日付関連ユーティリティ --------------------------------------------------

/**
 * Date オブジェクトを "YYYY-MM-DD" 形式の文字列に変換する。
 * - Firestore の plans.date と同じフォーマットに合わせるためのヘルパー。
 */
function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 指定した年・月（0-11）に含まれる日数を返す。
 * - new Date(year, month + 1, 0) を使うことで、翌月の0日目 = 当月末日 になる性質を利用。
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * "YYYY-MM-DD" 形式の文字列を Date に変換するヘルパー。
 * - パースに失敗した場合は null を返すことで、呼び出し側で安全に扱えるようにする。
 */
function parseDateString(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// ---- メインコンポーネント ----------------------------------------------------

export default function CalendarPage() {
  // ---- 初期値: 今日の日付を元に年/月/選択日を決定 -------------------------

  // useMemo を使って「初回レンダリング時の今日」を固定する。
  // こうしておくと、レンダリングのたびに new Date() が走って
  // 意図せず値がズレることを防げる。
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth()); // 0-11
  const [selectedDate, setSelectedDate] = useState<string>(formatDateYYYYMMDD(today));

  // ---- カレンダー表示用の集計結果 / ローディング状態 -----------------------

  /**
   * summaries: key を "YYYY-MM-DD" とした DaySummary の辞書。
   * - Firestore の plans を1ヶ月分まとめて取得し、
   *   日付ごとに件数・完了数・タイトル一覧を集計して格納する。
   */
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // ---- DayView からの「日付変更」を受けてカレンダー側も合わせる ----------

  /**
   * DayView からコールバックされる日付変更ハンドラ。
   * - 下部 DayView で日付を切り替えた場合でも、
   *   上部のカレンダーの年月を自動で追従させるために使用。
   */
  const handleDateChangeFromDayView = (newDate: string) => {
    setSelectedDate(newDate);

    const d = parseDateString(newDate);
    if (!d) return;

    const newYear = d.getFullYear();
    const newMonth = d.getMonth(); // 0-11

    // 年月が違っていたら、カレンダー側も合わせる
    setYear(newYear);
    setMonth(newMonth);
  };

  // ---- 月送りボタン（前の月 / 次の月） ------------------------------------

  /**
   * 前月へ移動する
   * - 月またぎのときは年も更新する。
   * - 月が変わると useEffect の依存配列 [year, month] が変化し、
   *   Firestore 再購読 & summaries 再集計が走る。
   */
  const goPrevMonth = () => {
    setSummaries({});
    setLoading(true);
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  };

  /**
   * 次の月へ移動する
   * - 前月版と同様に、12月 ⇒ 翌年1月 の処理を行う。
   */
  const goNextMonth = () => {
    setSummaries({});
    setLoading(true);
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  };

  // ---- Firestore から「その月の TODO」をまとめて取得する ------------------

  useEffect(() => {
    // 対象月の 1 日と末日を表す Date を作成
    const first = new Date(year, month, 1);
    const last = new Date(year, month, getDaysInMonth(year, month));

    const startStr = formatDateYYYYMMDD(first); // >=
    const endStr = formatDateYYYYMMDD(last);    // <=

    // date が "YYYY-MM-DD" 文字列として保存されている前提
    // ※ where と orderBy を同じフィールド date で使っているため、
    //   Firestore に複合インデックスを作成するよう要求される可能性あり。
    const q = query(
      collection(db, "plans"),
      where("date", ">=", startStr),
      where("date", "<=", endStr),
      orderBy("date", "asc")
    );

    // onSnapshot により、「その月の plans コレクションの変化」をリアルタイム購読する。
    const unsub = onSnapshot(
      q,
      (snap) => {
        const map = new Map<string, DaySummary>();

        // 1件ずつドキュメントを見ていき、日付ごとに集計していく。
        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const dateStr: string = d.date || ""; // "YYYY-MM-DD"
          if (!dateStr) return;

          // まだこの日付の DaySummary がなければ初期化
          if (!map.has(dateStr)) {
            map.set(dateStr, {
              date: dateStr,
              total: 0,
              done: 0,
              titles: [],
            });
          }

          const cur = map.get(dateStr)!;
          cur.total += 1;
          if (d.done) cur.done += 1;

          // タイトルはカレンダーセルに収まる程度の件数だけ保持する（ここでは最大3件）
          if (typeof d.title === "string" && d.title.trim()) {
            if (cur.titles.length < 3) {
              cur.titles.push(d.title.trim());
            }
          }
        });

        // Map を Record<string, DaySummary> に変換
        const obj: Record<string, DaySummary> = {};
        map.forEach((v, k) => {
          obj[k] = v;
        });

        setSummaries(obj);
        setLoading(false);
      },
      (err) => {
        console.error("CalendarPage onSnapshot error:", err);
        setSummaries({});
        setLoading(false);
      }
    );

    // クリーンアップ：コンポーネントアンマウント時 or year/month 変更時に購読解除
    return () => unsub();
  }, [year, month]);

  // ---- カレンダー用の「6週 × 7日」グリッドデータを生成 --------------------

  /**
   * weeks:
   * - 1マス = CalendarCell として、「日付文字列」と「日付数字」を保持。
   * - 6行×7列 (最大6週分) に展開し、レンダリング時に map で描画する。
   */
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay(); // 0:日〜6:土
    const daysInMonth = getDaysInMonth(year, month);

    const cells: CalendarCell[] = [];

    // 0〜41 の42マスを一気に作り、「当月の日付 or 空セル」に振り分ける
    for (let i = 0; i < 42; i++) {
      const dayNum = i - firstWeekday + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        // 当月でない部分 → 空セル
        cells.push({ dateStr: null, dayNumber: null });
      } else {
        const d = new Date(year, month, dayNum);
        cells.push({
          dateStr: formatDateYYYYMMDD(d),
          dayNumber: dayNum,
        });
      }
    }

    // 7日ごとに分割して「週」配列にする
    const w: CalendarCell[][] = [];
    for (let i = 0; i < 6; i++) {
      w.push(cells.slice(i * 7, i * 7 + 7));
    }
    return w;
  }, [year, month]);

  // 月表示ラベル（例: "2025年 02月"）
  const monthLabel = `${year}年 ${month + 1}月`;

  // ---- レンダリング ---------------------------------------------------------

  return (
    <main style={{ padding: 16 }}>
      {/* ---- カレンダーヘッダー（前月 / 現在の年月 / 次月） ---------------- */}
      <section
        style={{
          maxWidth: 800,
          margin: "0 auto",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button onClick={goPrevMonth}>◀ 前の月</button>
        <h2 style={{ margin: 0 }}>{monthLabel}</h2>
        <button onClick={goNextMonth}>次の月 ▶</button>
      </section>

      {/* ---- 月カレンダー本体 ----------------------------------------------- */}
      <section
        style={{
          maxWidth: 800,
          margin: "0 auto",
          border: "1px solid #eee",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* 曜日ヘッダ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            background: "#f9fafb",
            borderBottom: "1px solid #eee",
            textAlign: "center",
            padding: "4px 0",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <div>日</div>
          <div>月</div>
          <div>火</div>
          <div>水</div>
          <div>木</div>
          <div>金</div>
          <div>土</div>
        </div>

        {/* 日付グリッド */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
          }}
        >
          {weeks.map((week, wi) =>
            week.map((cell, ci) => {
              const key = `${wi}-${ci}`;
              const summary = cell.dateStr ? summaries[cell.dateStr] : undefined;
              const isSelected =
                cell.dateStr && cell.dateStr === selectedDate;

              return (
                <div
                  key={key}
                  style={{
                    borderRight:
                      (ci + 1) % 7 === 0 ? "none" : "1px solid #eee",
                    borderBottom:
                      wi === weeks.length - 1 ? "none" : "1px solid #eee",
                    minHeight: 80,
                    padding: 4,
                    boxSizing: "border-box",
                    background: isSelected
                      ? "rgba(59,130,246,0.1)" // 選択日をうっすら強調
                      : "white",
                    cursor: cell.dateStr ? "pointer" : "default",
                    opacity: cell.dateStr ? 1 : 0.4, // 前後月の空セルは半透明
                  }}
                  onClick={() => {
                    if (!cell.dateStr) return;
                    setSelectedDate(cell.dateStr);
                  }}
                >
                  {/* 日付数字（セル右上） */}
                  <div
                    style={{
                      textAlign: "right",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    {cell.dayNumber ?? ""}
                  </div>

                  {/* その日のざっくり TODO 情報 */}
                  {summary && (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        color: "#111827",
                      }}
                    >
                      {/* タイトルを数件まで表示（長いものは省略） */}
                      {summary.titles.map((t, i) => (
                        <div
                          key={i}
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          ・{t}
                        </div>
                      ))}

                      {/* タイトルに出していないタスクがあれば「+n件」と表示 */}
                      {summary.total > summary.titles.length && (
                        <div style={{ color: "#6b7280" }}>
                          他 {summary.total - summary.titles.length} 件
                        </div>
                      )}

                      {/* 完了数の概要表示 */}
                      <div style={{ color: "#10b981" }}>
                        完了 {summary.done}/{summary.total}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ---- 下部: 選択した日の DayView（詳細 TODO） ------------------------ */}
      <section
        style={{
          maxWidth: 800,
          margin: "16px auto 0",
        }}
      >
        <h3 style={{ marginBottom: 8 }}>{selectedDate} の詳細 TODO</h3>

        {/* DayView に initialDate と onDateChange を渡すことで
            双方向に日付を同期できるようにしている。 */}
        <DayView
          initialDate={selectedDate}
          onDateChange={handleDateChangeFromDayView}
        />
      </section>

      {/* ---- カレンダーデータ読み込み中のフローティングインジケータ -------- */}
      {loading && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            background: "rgba(0,0,0,0.6)",
            color: "white",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          カレンダーのデータ読み込み中…
        </div>
      )}
    </main>
  );
}
