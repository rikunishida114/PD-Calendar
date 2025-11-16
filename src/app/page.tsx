// app/page.tsx
import { redirect } from "next/navigation";


export default function Page() {
  // ルートアクセス時に /todo にリダイレクト
  redirect("/todo");
}
