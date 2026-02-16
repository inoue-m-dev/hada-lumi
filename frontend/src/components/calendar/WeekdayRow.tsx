const labels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function WeekdayRow() {
  return (
  <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold tracking-wide">
    {labels.map((w, i) => (
      <div
        key={w}
        className={[
          "text-center py-1",
          i === 0 ? "text-[#DEB7BA]" : "text-[#B4B7C0]",
        ].join(" ")}
      >
        {w}
      </div>
    ))}
  </div>
);
}
