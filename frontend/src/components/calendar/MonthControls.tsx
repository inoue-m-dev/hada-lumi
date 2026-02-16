interface Props {
  label: string;
  onPrev(): void;
  onNext(): void;
}

export default function MonthControls({ label, onPrev, onNext }: Props) {
  return (
    <section className="flex items-center justify-between">
      <button
  type="button"
  onClick={onPrev}
  className="h-9 w-9 rounded-full bg-white/70 border border-black/10 shadow-sm grid place-items-center"
  aria-label="前の月"
>
  ＜
</button>


      <div className="text-[18px] font-semibold tracking-tight text-[#596377]">
        {label}
      </div>

      <button
  type="button"
  onClick={onNext}
  className="h-9 w-9 rounded-full bg-white/70 border border-black/10 shadow-sm grid place-items-center"
  aria-label="次の月"
>
  ＞
</button>

    </section>
  );
}
