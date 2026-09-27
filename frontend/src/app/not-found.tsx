import { Compass } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-primary-soft">
        <Compass className="size-7 text-primary" />
      </span>
      <h1 className="text-[22px] font-bold text-heading">Página não encontrada</h1>
      <p className="text-[14px] text-ink-2">O endereço acessado não existe nesta plataforma.</p>
      <Link href="/" className="mt-2 text-[14px] font-semibold text-primary-ink hover:underline">
        Voltar ao início
      </Link>
    </div>
  );
}
