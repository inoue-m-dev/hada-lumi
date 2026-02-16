interface Props {
  title: string;
}

export default function CalendarHeader({ title }: Props) {
  return (
    <header className="px-4 py-3 border-b border-[#E0D8D2] bg-[#FDFBF9]">
      <h1 className="text-base font-semibold text-[#171412]">{title}</h1>
    </header>
  );
}
