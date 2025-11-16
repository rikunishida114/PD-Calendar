// src/app/calender/page.tsx
// 月表示カレンダー + その日のざっくり TODO 一覧 + 下に DayView を出すページ
// Firestore の plans コレクションから date="YYYY-MM-DD" で集計します。

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";              // あなたのプロジェクトで使っているパスに合わせてください
import DayView from "../components/DayView";      // 既存の日別ビュー

// 1日のタスクざっくり情報
type DaySummary = {
  date: string;       // "YYYY-MM-DD"
  total: number;      // 件数
  done: number;       // 完了数
  titles: string[];   // タイトル（先頭何件か）
};

// "YYYY-MM-DD" を作るユーティリティ（date-fns を使わない）
function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// その月の日数を返す
function getDaysInMonth(year: number, month: number): number {
  // month: 0-11 で受け取る前提
  return new Date(year, month + 1, 0).getDate();
}

// 追加：文字列 "YYYY-MM-DD" を Date に変換するヘルパ
function parseDateString(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export default function CalendarPage() {
  // 今日の日付からスタート
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth()); // 0-11
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // カレンダーで選択中の日付（下の DayView 用）
  const [selectedDate, setSelectedDate] = useState<string>(formatDateYYYYMMDD(today));

  // ★ DayView からの日付変更を受け取る
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

  // 月を前後に移動する
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

  // --- Firestore から「その月の TODO」をまとめて取得 ---
  useEffect(() => {
    // その月の 1 日と末日
    const first = new Date(year, month, 1);
    const last = new Date(year, month, getDaysInMonth(year, month));

    const startStr = formatDateYYYYMMDD(first); // >=
    const endStr = formatDateYYYYMMDD(last);    // <=

    // date が "YYYY-MM-DD" 文字列として保存されている前提
    // where + orderBy(date) の組み合わせなので、最初にインデックスを要求されるかもしれません
    const q = query(
      collection(db, "plans"),
      where("date", ">=", startStr),
      where("date", "<=", endStr),
      orderBy("date", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const map = new Map<string, DaySummary>();

        snap.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const dateStr: string = d.date || ""; // "YYYY-MM-DD"
          if (!dateStr) return;

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
          if (typeof d.title === "string" && d.title.trim()) {
            if (cur.titles.length < 3) {
              cur.titles.push(d.title.trim());
            }
          }
        });

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

    return () => unsub();
  }, [year, month]);

  // カレンダー用の 6週 x 7日 グリッドを作る
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay(); // 0:日〜6:土
    const daysInMonth = getDaysInMonth(year, month);

    const cells: { dateStr: string | null; dayNumber: number | null }[] = [];

    for (let i = 0; i < 42; i++) {
      const dayNum = i - firstWeekday + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells.push({ dateStr: null, dayNumber: null });
      } else {
        const d = new Date(year, month, dayNum);
        cells.push({
          dateStr: formatDateYYYYMMDD(d),
          dayNumber: dayNum,
        });
      }
    }

    // 7 日ごとに分割して「週」にする
    const w: { dateStr: string | null; dayNumber: number | null }[][] = [];
    for (let i = 0; i < 6; i++) {
      w.push(cells.slice(i * 7, i * 7 + 7));
    }
    return w;
  }, [year, month]);

  const monthLabel = `${year}年 ${month + 1}月`;

  return (
    <>
      {/* 上部ナビ */}

      <main style={{ padding: 16 }}>
        {/* カレンダーヘッダー（前月 / 月表示 / 次月） */}
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

        {/* 月カレンダー */}
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
                const summary =
                  cell.dateStr && summaries[cell.dateStr];

                const isSelected =
                  cell.dateStr && cell.dateStr === selectedDate;

                return (
                  <div
                    key={key}
                    style={{
                      borderRight:
                        (ci + 1) % 7 === 0 ? "none" : "1px solid #eee",
                      borderBottom:
                        wi === weeks.length - 1
                          ? "none"
                          : "1px solid #eee",
                      minHeight: 80,
                      padding: 4,
                      boxSizing: "border-box",
                      background: isSelected
                        ? "rgba(59,130,246,0.1)"
                        : "white",
                      cursor: cell.dateStr ? "pointer" : "default",
                      opacity: cell.dateStr ? 1 : 0.4,
                    }}
                    onClick={() => {
                      if (!cell.dateStr) return;
                      setSelectedDate(cell.dateStr);
                    }}
                  >
                    {/* 日付数字 */}
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
                        {/* タイトルを2件まで表示 */}
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
                        {/* まだタスクが残っていれば +n 件 */}
                        {summary.total > summary.titles.length && (
                          <div style={{ color: "#6b7280" }}>
                            他 {summary.total - summary.titles.length} 件
                          </div>
                        )}
                        {/* 完了数も軽く表示 */}
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

        {/* 下に DayView を表示（選択した日） */}
        <section
          style={{
            maxWidth: 800,
            margin: "16px auto 0",
          }}
        >
          <h3 style={{ marginBottom: 8 }}>
            {selectedDate} の詳細 TODO
          </h3>
          {/* ★ onDateChange を渡す */}
          <DayView
            initialDate={selectedDate}
            onDateChange={handleDateChangeFromDayView}
          />
        </section>

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
    </>
  );
}
