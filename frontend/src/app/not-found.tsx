import { Compass } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-32 text-center">
      <Compass className="size-8 text-ink-3" />
      <h1 className="text-[20px] font-semibold text-ink">Página não encontrada</h1>
      <p className="text-[13.5px] text-ink-3">O endereço acessado não existe nesta plataforma.</p>
      <Link href="/" className="mt-2 text-[13px] font-medium text-accent-soft hover:text-accent">
        Voltar ao dashboard
      </Link>
    </div>
  );
}
